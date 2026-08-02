"""
Training pipeline: Stratified K-Fold cross-validation over a multi-modal
(image + metadata) dataset, with checkpoint saving and metric evaluation.

Expected dataset layout (dataset_dir):

    dataset_dir/
        metadata.csv          # columns: image_path,age,sex,anatomical_site,label
        images/                # referenced by image_path (relative or absolute)

`metadata.csv` columns:
    image_path       str   path to the image (relative to dataset_dir or absolute)
    age               int   patient age
    sex               str   one of: male, female, unknown
    anatomical_site   str   one of Settings.ANATOMICAL_SITES
    label             str   class name (must match Settings.CLASS_NAMES) or int index
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional

import cv2
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import StratifiedKFold
from torch.utils.data import DataLoader, Dataset

from app.config import Settings
from app.models.multimodal_net import build_model
from app.schemas import AnatomicalSiteEnum, PatientMetadata, SexEnum
from app.services.preprocessing import (
    build_inference_transform,
    build_training_transform,
    encode_metadata,
)

logger = logging.getLogger(__name__)


@dataclass
class FoldMetrics:
    fold: int
    accuracy: float
    f1_macro: float
    val_loss: float


@dataclass
class TrainingResult:
    fold_metrics: List[FoldMetrics] = field(default_factory=list)
    mean_accuracy: float = 0.0
    mean_f1_macro: float = 0.0
    best_checkpoint_path: Optional[str] = None
    total_training_seconds: float = 0.0


class SkinLesionDataset(Dataset):
    """Loads images + metadata from a pandas DataFrame produced from metadata.csv."""

    def __init__(
        self,
        dataframe: pd.DataFrame,
        settings: Settings,
        dataset_root: Path,
        is_train: bool,
        label_to_index: Dict[str, int],
    ):
        self.df = dataframe.reset_index(drop=True)
        self.settings = settings
        self.dataset_root = dataset_root
        self.label_to_index = label_to_index
        self.transform = (
            build_training_transform(settings.IMAGE_SIZE)
            if is_train
            else build_inference_transform(settings.IMAGE_SIZE)
        )

    def __len__(self) -> int:
        return len(self.df)

    def _resolve_path(self, image_path: str) -> Path:
        p = Path(image_path)
        if p.is_absolute():
            return p
        return self.dataset_root / p

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        image_path = self._resolve_path(str(row["image_path"]))

        image_bgr = cv2.imread(str(image_path))
        if image_bgr is None:
            image_rgb = np.zeros(
                (self.settings.IMAGE_SIZE, self.settings.IMAGE_SIZE, 3), dtype=np.uint8
            )
            logger.warning("Failed to read image %s; using a blank placeholder.", image_path)
        else:
            image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

        transformed = self.transform(image=image_rgb)
        image_tensor = transformed["image"].float()

        sex_raw = str(row.get("sex", "unknown")).lower()
        sex_value = sex_raw if sex_raw in {e.value for e in SexEnum} else SexEnum.UNKNOWN.value

        site_raw = str(row.get("anatomical_site", "unknown")).lower()
        site_value = (
            site_raw if site_raw in {e.value for e in AnatomicalSiteEnum} else AnatomicalSiteEnum.UNKNOWN.value
        )

        metadata = PatientMetadata(
            age=int(row.get("age", 0)) if not pd.isna(row.get("age", 0)) else 0,
            sex=SexEnum(sex_value),
            anatomical_site=AnatomicalSiteEnum(site_value),
        )
        metadata_tensor = encode_metadata(metadata, self.settings).squeeze(0)

        raw_label = row["label"]
        if isinstance(raw_label, (int, np.integer)):
            label_idx = int(raw_label)
        else:
            label_idx = self.label_to_index[str(raw_label)]

        label_tensor = torch.tensor(label_idx, dtype=torch.long)
        return image_tensor, metadata_tensor, label_tensor


def _build_label_mapping(df: pd.DataFrame, settings: Settings) -> Dict[str, int]:
    if df["label"].dtype == object:
        unique_labels = sorted(df["label"].astype(str).unique())
        if set(unique_labels).issubset(set(settings.CLASS_NAMES)):
            return {name: settings.CLASS_NAMES.index(name) for name in unique_labels}
        return {name: idx for idx, name in enumerate(unique_labels)}
    # Already integer-encoded
    return {str(i): i for i in range(settings.NUM_CLASSES)}


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
) -> float:
    model.train()
    running_loss = 0.0
    n_samples = 0
    for images, metadata, labels in loader:
        images, metadata, labels = (
            images.to(device),
            metadata.to(device),
            labels.to(device),
        )
        optimizer.zero_grad(set_to_none=True)
        logits = model(images, metadata)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        n_samples += images.size(0)

    return running_loss / max(n_samples, 1)


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, float, float]:
    model.eval()
    running_loss = 0.0
    n_samples = 0
    all_preds: List[int] = []
    all_labels: List[int] = []

    for images, metadata, labels in loader:
        images, metadata, labels = (
            images.to(device),
            metadata.to(device),
            labels.to(device),
        )
        logits = model(images, metadata)
        loss = criterion(logits, labels)

        running_loss += loss.item() * images.size(0)
        n_samples += images.size(0)

        preds = torch.argmax(logits, dim=1)
        all_preds.extend(preds.cpu().tolist())
        all_labels.extend(labels.cpu().tolist())

    avg_loss = running_loss / max(n_samples, 1)
    accuracy = accuracy_score(all_labels, all_preds)
    f1_macro = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    return avg_loss, accuracy, f1_macro


def run_cross_validation_training(
    dataset_dir: str,
    settings: Settings,
    epochs: Optional[int] = None,
    batch_size: Optional[int] = None,
    n_splits: Optional[int] = None,
    learning_rate: Optional[float] = None,
    progress_callback: Optional[Callable[[int, int, int, int], None]] = None,
) -> TrainingResult:
    """
    Runs Stratified K-Fold cross-validation training and returns aggregate metrics.

    `progress_callback(fold, total_folds, epoch, total_epochs)` is invoked after
    each epoch, allowing a caller (e.g. a background task) to report progress.
    """
    torch.manual_seed(settings.RANDOM_SEED)
    np.random.seed(settings.RANDOM_SEED)

    dataset_root = Path(dataset_dir)
    metadata_csv = dataset_root / "metadata.csv"
    if not metadata_csv.exists():
        raise FileNotFoundError(f"metadata.csv not found under {dataset_root}")

    df = pd.read_csv(metadata_csv)
    required_columns = {"image_path", "age", "sex", "anatomical_site", "label"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"metadata.csv is missing required columns: {missing}")

    label_to_index = _build_label_mapping(df, settings)
    df["label_idx"] = df["label"].astype(str).map(
        {k: v for k, v in label_to_index.items()}
    ) if df["label"].dtype == object else df["label"]

    epochs = epochs or settings.EPOCHS
    batch_size = batch_size or settings.BATCH_SIZE
    n_splits = n_splits or settings.N_SPLITS
    learning_rate = learning_rate or settings.LEARNING_RATE

    device = torch.device(
        "cuda" if torch.cuda.is_available() else
        ("mps" if torch.backends.mps.is_available() else "cpu")
    )

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=settings.RANDOM_SEED)

    result = TrainingResult()
    best_f1 = -1.0
    start_time = time.perf_counter()

    features = df.index.values
    stratify_target = df["label_idx"].values

    for fold, (train_idx, val_idx) in enumerate(skf.split(features, stratify_target), start=1):
        logger.info("Starting fold %d/%d", fold, n_splits)

        train_df = df.iloc[train_idx].assign(label=df.iloc[train_idx]["label_idx"])
        val_df = df.iloc[val_idx].assign(label=df.iloc[val_idx]["label_idx"])

        train_dataset = SkinLesionDataset(
            train_df, settings, dataset_root, is_train=True, label_to_index=label_to_index
        )
        val_dataset = SkinLesionDataset(
            val_df, settings, dataset_root, is_train=False, label_to_index=label_to_index
        )

        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=settings.NUM_WORKERS,
            drop_last=True,
        )
        val_loader = DataLoader(
            val_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=settings.NUM_WORKERS,
        )

        model = build_model(
            num_classes=settings.NUM_CLASSES,
            metadata_input_dim=settings.metadata_vector_size,
            backbone=settings.BACKBONE,
            pretrained=True,
        ).to(device)

        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", factor=0.5, patience=2
        )
        criterion = nn.CrossEntropyLoss()

        best_fold_f1 = -1.0
        best_fold_metrics = None

        for epoch in range(1, epochs + 1):
            train_loss = train_one_epoch(model, train_loader, optimizer, criterion, device)
            val_loss, accuracy, f1_macro = evaluate(model, val_loader, criterion, device)
            scheduler.step(val_loss)

            logger.info(
                "Fold %d Epoch %d/%d - train_loss=%.4f val_loss=%.4f acc=%.4f f1_macro=%.4f",
                fold, epoch, epochs, train_loss, val_loss, accuracy, f1_macro,
            )

            if progress_callback:
                progress_callback(fold, n_splits, epoch, epochs)

            if f1_macro > best_fold_f1:
                best_fold_f1 = f1_macro
                best_fold_metrics = FoldMetrics(
                    fold=fold, accuracy=accuracy, f1_macro=f1_macro, val_loss=val_loss
                )

        assert best_fold_metrics is not None
        result.fold_metrics.append(best_fold_metrics)

        if best_fold_f1 > best_f1:
            best_f1 = best_fold_f1
            checkpoint_path = settings.CHECKPOINT_DIR / f"best_model_fold{fold}.pth"
            torch.save(model.state_dict(), checkpoint_path)
            result.best_checkpoint_path = str(checkpoint_path)

            final_model_path = settings.model_path
            torch.save(model.state_dict(), final_model_path)

            with open(settings.label_map_path, "w", encoding="utf-8") as f:
                json.dump(label_to_index, f, indent=2)

            logger.info("New best model saved to %s (f1_macro=%.4f)", checkpoint_path, best_f1)

    result.mean_accuracy = float(np.mean([m.accuracy for m in result.fold_metrics]))
    result.mean_f1_macro = float(np.mean([m.f1_macro for m in result.fold_metrics]))
    result.total_training_seconds = time.perf_counter() - start_time

    logger.info(
        "Cross-validation complete. mean_accuracy=%.4f mean_f1_macro=%.4f duration=%.1fs",
        result.mean_accuracy, result.mean_f1_macro, result.total_training_seconds,
    )
    return result
