import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CountryDoctorList from "../components/CountryDoctorList";
import ConsultSteps from "../components/ConsultSteps";

/**
 * "Get Doctor's Opinion", step 1: pick a doctor from the patient's country.
 * Port of mobile/src/screens/SelectDoctorScreen.js. The prediction travels in
 * router state (or is refetched by id on the next screen).
 */
export default function SelectDoctorScreen() {
  const { predictionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <CountryDoctorList
      header={
        <div className="flex flex-col gap-4">
          <ConsultSteps current={1} />
          <p className="text-[15px] text-muted">Choose a verified dermatologist to review your result.</p>
        </div>
      }
      onSelectDoctor={(doctor) =>
        navigate(`/results/${predictionId}/consult/${doctor._id}`, {
          state: {
            doctor,
            prediction: location.state?.prediction,
            // Lets the send screen return to the result like mobile's popTo("Result").
            fromResult: Boolean(location.state?.prediction),
          },
        })
      }
    />
  );
}
