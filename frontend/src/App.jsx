import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import SkinAnalysisContent from "./components/SkinAnalysisContent.jsx";
import AnalysisResults from "./components/AnalysisResults.jsx";
import { mockValidateImage } from "./api/mockValidation.js";
import { predictLesion } from "./api/client.js";

const INITIAL_METADATA = { age: "", sex: "female", anatomical_site: "torso" };

function SkinAnalysisPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [metadata, setMetadata] = useState(INITIAL_METADATA);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [oodError, setOodError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const methods = useForm({
    defaultValues: INITIAL_METADATA,
  });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setIsValidated(false);
      setOodError(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Trigger validation when file is uploaded
    validateImage(file);
    
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validateImage = async (imageFile) => {
    setIsValidating(true);
    setOodError(null);
    setIsValidated(false);

    try {
      const result = await mockValidateImage(imageFile);
      if (result.valid) {
        setIsValidated(true);
      } else {
        setOodError(result.message);
      }
    } catch (err) {
      setOodError("Validation failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileSelected = (selectedFile, error) => {
    setFile(selectedFile);
    if (error) {
      setOodError(error);
      setIsValidated(false);
    }
  };

  const handleFileRemove = () => {
    setFile(null);
    setPreviewUrl(null);
    setIsValidated(false);
    setOodError(null);
  };

  const handleMetadataChange = (newMetadata) => {
    setMetadata(newMetadata);
    methods.setValue("age", newMetadata.age);
    methods.setValue("sex", newMetadata.sex);
    methods.setValue("anatomical_site", newMetadata.anatomical_site);
  };

  const handleAnalyze = async () => {
    if (!file || !isValidated) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await predictLesion(file, {
        ...metadata,
        age: Number(metadata.age),
      });
      // Object URLs are revoked when this page unmounts. Persist a data URL instead.
      const originalImage = await fileToDataUrl(file);
      sessionStorage.setItem("analysisResult", JSON.stringify(result));
      sessionStorage.setItem("previewImage", originalImage);
      navigate("/analysis-results");
    } catch (err) {
      console.error("Analysis failed:", err);
      setAnalysisError(err.message || "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <SkinAnalysisContent
        file={file}
        previewUrl={previewUrl}
        metadata={metadata}
        isValidating={isValidating}
        isValidated={isValidated}
        oodError={oodError}
        analysisError={analysisError}
        onFileSelected={handleFileSelected}
        onFileRemove={handleFileRemove}
        onMetadataChange={handleMetadataChange}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
      />
    </FormProvider>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not prepare the image preview."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout><SkinAnalysisPage /></AppLayout>} />
        <Route path="/analysis-results" element={<AnalysisResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
