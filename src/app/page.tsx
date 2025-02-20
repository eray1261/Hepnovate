"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Header } from "@/components/layout/Header";
import { parse } from 'csv-parse';
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Symptom = {
  name: string;
  detected: boolean;
}

type Vitals = {
  temperature?: string;
  bloodPressure?: string;
  pulse?: string;
}

export default function Home() {
  const [selectedPatientId, setSelectedPatientId] = useState('P1000'); // Set initial patient ID
  const [symptoms, setSymptoms] = useState<Symptom[]>([
    { name: "Fatigue", detected: false },
    { name: "Weight Loss", detected: false },
    { name: "Fever", detected: false },
    { name: "Night Sweats", detected: false },
    { name: "Abdominal Pain", detected: false },
    { name: "Nausea", detected: false },
    { name: "Jaundice", detected: false },
    { name: "Loss of Appetite", detected: false }
  ]);
  const [vitals, setVitals] = useState<Vitals>({});
  const [labResults, setLabResults] = useState();
  const [medicalHistory, setMedicalHistory] = useState({
    activeConditions:[],
    currentMedication:[],
  });
  const router = useRouter();

  useEffect(() => {
    const loadCSVData = async () => {
      try {
        // Load Lab Results
        const labResultsResponse = await fetch('/epic_data/lab_results.csv');
        if (!labResultsResponse.ok) {
          throw new Error(`HTTP error! status: ${labResultsResponse.status}`);
        }
        const labResultsCSV = await labResultsResponse.text();

        parse(labResultsCSV, {
          columns: true,
          skip_empty_lines: true,
        }, (err, records) => {
          if (err) {
            console.error("Lab Results parsing error:", err);
            return;
          }

          // Find the data for the selected patient
          const selectedPatientData = records.find(patient => patient['Patient ID'] === selectedPatientId);

          if (selectedPatientData) {
            const patientLabResults = Object.entries(selectedPatientData)
            .filter(([key]) => key!== 'Patient ID')
            .map(([name, value]) => ({ name, value, unit: '' }));

            setLabResults(patientLabResults);
          } else {
            console.log("Patient data not found for ID:", selectedPatientId);
            setLabResults();
          }
        });

        // Load and parse medical history
        const medicalHistoryResponse = await fetch('/epic_data/medical_history.csv');
        if (!medicalHistoryResponse.ok) {
          throw new Error(`HTTP error! status: ${medicalHistoryResponse.status}`);
        }
        const medicalHistoryCSV = await medicalHistoryResponse.text();

        parse(medicalHistoryCSV, {
          columns: true,
          skip_empty_lines: true,
        }, (err, records) => {
          if (err) {
            console.error("Medical History parsing error:", err);
            return;
          }

          const newMedicalHistory = {
            activeConditions:[],
            currentMedication:[],
          };

          const selectedPatientRecords = records.filter(record => record['Patient ID'] === selectedPatientId);

          selectedPatientRecords.forEach(item => {
            if (item.Type === 'Active Condition') {
              newMedicalHistory.activeConditions.push({
                condition: item.Condition,
                date: item.Date,
              });
            } else if (item.Type === 'Current Medication') {
              newMedicalHistory.currentMedication.push({
                name: item.Medication,
                dosage: item.Dosage,
              });
            }
          });

          setMedicalHistory(newMedicalHistory);
        });

      } catch (error) {
        console.error("Error loading CSVs:", error);
      }
    };

    loadCSVData();
  }, [selectedPatientId]);

  return (
    <main className="h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto p-4 space-y-2 overflow-hidden">
        {/* Top Grid: Symptoms, Vitals, and Transcription */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Current Symptoms Card */}
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-[#80BCFF]">Current Symptoms</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="space-y-2">
                  {symptoms
                    .filter(symptom => symptom.detected)
                    .map((symptom) => (
                      <div 
                        key={symptom.name} 
                        className="p-2 rounded text-black"
                      >
                        {symptom.name}
                      </div>
                    ))}
                    {!symptoms.some(s => s.detected) && (
                      <div className="text-black">No symptoms detected</div>
                    )}
                </div>
              </CardContent>
            </Card>

            {/* Current Vitals Card */}
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-[#80BCFF]">Current Vitals</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-black">
                    <span>Temperature</span>
                    <span>{vitals.temperature || "Value"}</span>
                  </div>
                  <div className="flex justify-between text-black">
                    <span>Blood Pressure</span>
                    <span>{vitals.bloodPressure || "Value"}</span>
                  </div>
                  <div className="flex justify-between text-black">
                    <span>Pulse</span>
                    <span>{vitals.pulse || "Value"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="py-2 flex flex-row items-center justify-between">
                <CardTitle className="text-[#80BCFF]">Live Transcription</CardTitle>
                <button 
                  className="bg-red-500 text-white px-4 py-1 rounded-md flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-white"></span>
                  Start Recording
                </button>
              </CardHeader>
              <CardContent className="py-2">
                <div className="h-[150px] bg-gray-50 rounded-md p-3 text-black">
                  Waiting for audio input...
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
          
        {/* Lab Results and Medical History Section */}
        <div className="grid grid-cols-3 gap-4">
          {/* Empty space for expanding symptoms */}
          <div></div>
          
          {/* Lab Results and Medical History taking 2/3 of space */}
          <div className="col-span-2">
            <Card className="w-full">
              <div className="m-4 p-4 border-2 border-dashed border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 gap-8">
                  {/* Lab Results */}
                  <div>
                    <CardTitle className="text-[#80BCFF] mb-4">Recent Lab Results</CardTitle>
                    <div className="space-y-2 text-black">
                      {labResults && labResults.length > 0? ( // Check if labResults is defined and not empty
                        labResults.map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{item.name}</span>
                            <input
                              type="text"
                              value={item.value}
                              placeholder={item.unit}
                              className="w-24 px-2 py-1 text-sm border rounded-md text-right bg-gray-50 text-gray-500"
                              readOnly
                            />
                          </div>
                        ))
                      ): (
                        <div>Loading lab results...</div>
                      )}
                    </div>
                  </div>

                  {/* Medical History - Single Column */}
                  <div>
                    <CardTitle className="text-[#80BCFF] mb-4">Medical History</CardTitle>
                    <div className="max-h-[300px] overflow-y-auto pr-2">
                      {/* Active Conditions */}
                      <div className="mb-4">
                        <h4 className="text-black font-bold mb-2">Active Conditions</h4>
                        {medicalHistory.activeConditions.map((item, index) => (
                          <div key={index} className="bg-gray-50 mb-2 p-2 rounded">
                            <div className="text-sm font-medium text-black">{item.condition}</div>
                            <div className="text-xs text-black">Diagnosed: {item.date}</div>
                          </div>
                        ))}
                      </div>

                      {/* Current Medication */}
                      <div>
                        <h4 className="text-black font-bold mb-2">Current Medication</h4>
                        {medicalHistory.currentMedication.map((item, index) => (
                          <div key={index} className="bg-gray-50 mb-2 p-2 rounded">
                            <div className="text-sm font-medium text-black">{item.name}</div>
                            <div className="text-xs text-black">{item.dosage}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Button */}
                <div className="flex justify-end mt-4">
                  <button 
                    onClick={() => router.push('/scan')}
                    className="bg-[#80BCFF] text-white px-8 py-2 rounded-lg flex items-center gap-1"
                  >
                    Next <span className="text-lg">→</span>
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}