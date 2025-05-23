//new version
"use client"

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/card"
import { useRouter } from "next/navigation"
import { parse } from "csv-parse"
import { 
  getCurrentDiagnosis, 
  storeCurrentDiagnosis,
  DiagnosisResult
} from "@/services/diagnosisStorage";


type Symptom = {
  name: string;
  detected: boolean;
}

type Vitals = {
  temperature?: string;
  bloodPressure?: string;
  pulse?: string;
}
type LabResult = {
  name: string;
  value: string;
  flag?: string;
  unit: string;
}
type MedicalHistory = {
  activeConditions: Array<{
    condition: string;
    date: string;
  }>;
  currentMedication: Array<{
    name: string;
    dosage: string;
  }>;
  pastSurgeries: Array<{
    surgery: string;
    date: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
  }>;
  socialHistory: string;
  familyHistory: string;
  immunizations: Array<{
    immunization: string;
    date: string;
  }>;
}
type PatientRecord = {
  'Patient ID': string;
  [key: string]: string; // Allows for other lab result fields
};


export default function Home() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [vitals, setVitals] = useState<Vitals>({})
  const [transcription, setTranscription] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const router = useRouter()
  const [selectedPatientId, setSelectedPatientId] = useState('P1000')
  const [patientIds, setPatientIds] = useState<string[]>(['P1000', 'P1001', 'P1002', 'P1003'])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
    activeConditions: [],
    currentMedication: [],
    pastSurgeries: [],
    allergies: [],
    socialHistory: "",
    familyHistory: "",
    immunizations: []
  })
  const [labTestDate, setLabTestDate] = useState<string>("")
  const [websocketConnected, setWebsocketConnected] = useState(false)
  const [authToken, setAuthToken] = useState<string>("");
  const labUnitMapping: { [key: string]: string } = {
    "ALT": "U/L",
    "AST": "U/L",
    "ALP": "U/L",
    "Albumin": "g/dL",
    "Total Protein": "g/dL",
    "Bilirubin": "mg/dL",
    "GGT": "U/L",
    "LD": "U/L",
    "PT": "sec",
    "INR": "",
    "Platelets": "K/μL",
    "WBC": "K/μL",
    "Hemoglobin": "g/dL",
    "Hematocrit": "%",
    "Creatinine": "mg/dL",
    "BUN": "mg/dL",
    "Sodium": "mEq/L",
    "Potassium": "mEq/L",
    "Chloride": "mEq/L",
    "Bicarbonate": "mEq/L",
    "Glucose": "mg/dL"
  }


  // Load saved data from localStorage on initial render
  useEffect(() => {
    const savedDiagnosis = getCurrentDiagnosis();
    if (savedDiagnosis) {
      // Convert saved symptoms to the right format
      if (savedDiagnosis.symptoms && savedDiagnosis.symptoms.length > 0) {
        const formattedSymptoms = savedDiagnosis.symptoms.map(name => ({
          name,
          detected: true
        }));
        setSymptoms(formattedSymptoms);
      }
      
      // Set saved vitals
      if (savedDiagnosis.vitals) {
        setVitals(savedDiagnosis.vitals);
      }
    }
  }, []);

  // Save symptoms and vitals to localStorage whenever they change
  useEffect(() => {
    // Only save if there's something to save
    if (symptoms.length > 0 || Object.keys(vitals).length > 0) {
      const currentData: DiagnosisResult = {
        diagnoses: [],
        symptoms: symptoms.map(s => s.name),
        vitals: vitals
      };
      storeCurrentDiagnosis(currentData);
    }
  }, [symptoms, vitals]);

  useEffect(() => {
    const getDeepgramToken = async () => {
      try {
        const response = await fetch('/api/get-deepgram-token');
        const data = await response.json();
        
        if (data.token) {
          setAuthToken(data.token);
          setError(null);
        } else {
          setError("Failed to get authentication token");
          setWebsocketConnected(false);
        }
      } catch (err) {
        console.error("Error getting Deepgram token:", err);
        setError("Connection error. Please try again.");
        setWebsocketConnected(false);
      }
    };
    
    getDeepgramToken();
    
    // Clean up on component unmount
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const loadCSVData = async () => {
        try {
            // Load Lab Results with debugging
            // Load Lab Results with debugging
      const labResultsResponse = await fetch('/data/lab_results.csv');
      if (!labResultsResponse.ok) {
        console.error("Failed to load lab results:", labResultsResponse.status);
        return;
      }
      const labResultsCSV = await labResultsResponse.text();
      
      // Log the raw CSV data
      console.log("Raw CSV data:", labResultsCSV.substring(0, 200) + "...");

      parse(labResultsCSV, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }, (err, records: Array<{ [key: string]: string }>) => {
        if (err) {
          console.error("Lab Results parsing error:", err);
          return;
        }
        
        // Log all parsed records
        console.log("All parsed records:", records);

        // Extract all unique patient IDs
        const uniquePatientIds = [...new Set(records.map(record => record['Patient ID']))];
        if (uniquePatientIds.length > 0) {
          setPatientIds(uniquePatientIds);
        }

        const selectedPatientData = records.find(patient => patient['Patient ID'] === selectedPatientId);
        console.log("Selected patient data:", selectedPatientData);

        if (selectedPatientData) {
          // Save test date if available
          if (selectedPatientData['Test Date']) {
            setLabTestDate(selectedPatientData['Test Date']);
          }

          // Process all lab results, extracting values and flags
          const patientLabResults: LabResult[] = [];
          
          // Get all columns first
          const allColumns = Object.keys(selectedPatientData);
          console.log("All columns:", allColumns);
          
          // Process each lab test column (those that don't end with 'Flag' and aren't Patient ID or Test Date)
          for (const column of allColumns) {
            if (column === 'Patient ID' || column === 'Test Date' || column.endsWith(' Flag')) {
              continue;
            }
            
            // Get the value for this test
            const value = selectedPatientData[column];
            
            // Find the corresponding flag column and value
            const flagColumn = `${column} Flag`;
            const flag = selectedPatientData[flagColumn] || "";
            
            // Get the unit from our mapping
            const unit = labUnitMapping[column] || "";
            
            console.log(`Processing column: ${column}, value: ${value}, flag: ${flag}, unit: ${unit}`);
            
            // Create the lab result object
            patientLabResults.push({
              name: column,
              value: String(value || "").trim(),
              flag: String(flag || "").trim(),
              unit: unit
            });
          }
          
          // Debug the final processed results
          console.log("Processed lab results:", patientLabResults);
          
          // Set the lab results (the full array)
          setLabResults(patientLabResults);
            
        } else {
          console.log("Patient data not found for ID:", selectedPatientId);
          setLabResults([]);
        }
      });

            // Load Medical History - updated parsing logic
            const medicalHistoryResponse = await fetch('/data/medical_history.csv');
            if (!medicalHistoryResponse.ok) {
                console.error("Failed to load medical history:", medicalHistoryResponse.status);
                return;
            }
            const medicalHistoryCSV = await medicalHistoryResponse.text();

            parse(medicalHistoryCSV, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }, (err, records: Array<{ 
                'Patient ID': string;
                'Active Conditions': string;
                'Current Medications': string;
                'Past Surgeries': string;
                'Surgery Dates': string;
                'Allergies': string;
                'Reactions': string;
                'Social History': string;
                'Family History': string;
                'Immunizations': string;
                'Immunization Dates': string;
            }>) => {
                if (err) {
                    console.error("Medical History parsing error:", err);
                    return;
                }

                const selectedPatientData = records.find(record => record['Patient ID'] === selectedPatientId);

                if (selectedPatientData) {
                    // Parse Active Conditions (existing code)
                    const conditionsStr = selectedPatientData['Active Conditions']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                    
                    const conditions = conditionsStr.split('), (').map(condition => {
                        const [name, date] = condition
                            .replace(/^\(|\)$/g, '') // Remove parentheses
                            .split(', ');
                        return {
                            condition: name,
                            date: date
                        };
                    });

                    // Parse Current Medications (existing code)
                    const medicationsStr = selectedPatientData['Current Medications']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                    
                    const medications = medicationsStr.split('), (').map(medication => {
                        const [name, dosage] = medication
                            .replace(/^\(|\)$/g, '') // Remove parentheses
                            .split(', ');
                        return {
                            name: name,
                            dosage: dosage
                        };
                    });

                    // Parse Past Surgeries (new)
                    const surgeriesStr = selectedPatientData['Past Surgeries']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                    
                    const surgeryDatesStr = selectedPatientData['Surgery Dates']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                        
                    const surgeries = surgeriesStr.split(', ').map((surgery, index) => {
                        const dates = surgeryDatesStr.split(', ');
                        return {
                            surgery: surgery,
                            date: dates[index] || ''
                        };
                    });

                    // Parse Allergies (new)
                    const allergiesStr = selectedPatientData['Allergies']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                        
                    const reactionsStr = selectedPatientData['Reactions']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                        
                    const allergies = allergiesStr.split(', ').map((allergen, index) => {
                        const reactions = reactionsStr.split(', ');
                        return {
                            allergen: allergen,
                            reaction: reactions[index] || ''
                        };
                    });

                    // Parse Immunizations (new)
                    const immunizationsStr = selectedPatientData['Immunizations']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                        
                    const immunizationDatesStr = selectedPatientData['Immunization Dates']
                        .replace(/^\[|\]$/g, '') // Remove outer brackets
                        .replace(/['"]/g, '');    // Remove quotes
                        
                    const immunizations = immunizationsStr.split(', ').map((immunization, index) => {
                        const dates = immunizationDatesStr.split(', ');
                        return {
                            immunization: immunization,
                            date: dates[index] || ''
                        };
                    });

                    setMedicalHistory({
                        activeConditions: conditions,
                        currentMedication: medications,
                        pastSurgeries: surgeries,
                        allergies: allergies,
                        socialHistory: selectedPatientData['Social History'] || '',
                        familyHistory: selectedPatientData['Family History'] || '',
                        immunizations: immunizations
                    });
                } else {
                    console.log("Patient data not found for ID:", selectedPatientId);
                    setMedicalHistory({
                        activeConditions: [],
                        currentMedication: [],
                        pastSurgeries: [],
                        allergies: [],
                        socialHistory: "",
                        familyHistory: "",
                        immunizations: []
                    });
                }
            });

        } catch (error) {
            console.error("Error loading CSVs:", error);
        }
    };

    loadCSVData();
  }, [selectedPatientId, labUnitMapping]);

  const startRecording = async () => {
    try {
      // Make sure we have an auth token
      if (!authToken) {
        setError("Authentication not ready. Please try again.");
        return;
      }
      
      // Initialize Deepgram WebSocket directly
      websocketRef.current = new WebSocket('wss://api.deepgram.com/v1/listen', [
        'token',
        authToken
      ]);
      
      // Set up WebSocket event handlers
      websocketRef.current.onopen = () => {
        console.log('Deepgram connection established');
        setWebsocketConnected(true);
        setError(null);
        
        // Configure Deepgram
        const configMessage = {
          sample_rate: 16000,
          encoding: 'linear16',
          channels: 1,
          language: 'en',
          model: 'nova-2',
          interim_results: true,
          endpointing: 300,
        };
        
        websocketRef.current?.send(JSON.stringify(configMessage));
        
        // Now start recording
        startMicrophoneRecording();
      };

      websocketRef.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives[0]?.transcript) {
            const newTranscript = data.channel.alternatives[0].transcript;
            setTranscription(prev => prev + ' ' + newTranscript);
            detectSymptomsAndVitals(newTranscript);
          }
        } catch (err) {
          console.error('Error parsing Deepgram response:', err);
        }
      };
      
      websocketRef.current.onerror = (event: Event) => {
        console.error('Deepgram WebSocket error:', event);
        setError('Connection error occurred');
        setWebsocketConnected(false);
        stopRecording();
      };
      
      websocketRef.current.onclose = () => {
        console.log('Deepgram connection closed');
        setWebsocketConnected(false);
      };
      
    } catch (err) {
      console.error('Error starting Deepgram connection:', err);
      setError('Failed to connect to transcription service');
    }
  };

  const startMicrophoneRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
          // Convert Blob to ArrayBuffer before sending
          const reader = new FileReader();
          reader.onload = () => {
            if (websocketRef.current?.readyState === WebSocket.OPEN && reader.result) {
              websocketRef.current.send(reader.result);
            }
          };
          reader.readAsArrayBuffer(event.data);
        }
      };
      
      mediaRecorderRef.current.start(250); // Collect audio data every 250ms
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    // Stop the media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    // Close the WebSocket connection
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.close();
    }
    
    setIsRecording(false);
    setWebsocketConnected(false);
  };


  // Reset function for symptoms, vitals, and transcription
  const resetData = () => {
    setSymptoms([]);
    setVitals({});
    setTranscription('');
    
    // Clear from localStorage but keep the structure
    const emptyData: DiagnosisResult = {
      diagnoses: [],
      symptoms: [],
      vitals: {}
    };
    storeCurrentDiagnosis(emptyData);
  };

  const detectSymptomsAndVitals = async (transcript: string) => {
    try {
      setIsAnalyzing(true);
      
      const response = await fetch('/api/detect-symptoms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript })
      });
  
      if (!response.ok) throw new Error('Failed to detect medical information');
      
      const { symptoms: detectedSymptoms, vitals: detectedVitals } = await response.json();
      
      // Update symptoms with deduplication and filtering
      setSymptoms(prevSymptoms => {
        // Filter out the template text if it got included
        const validSymptoms = detectedSymptoms
          .filter((symptom: string) => 
            symptom !== '[comma-separated list]' && 
            symptom !== 'comma-separated list' &&
            symptom.trim() !== '' &&
            !symptom.includes('{') &&
            !symptom.includes('}')
          );
  
        const existingSymptoms = new Set(prevSymptoms.map(s => s.name.toLowerCase()));
        const newSymptoms = validSymptoms
          .filter((symptom: string) => !existingSymptoms.has(symptom.toLowerCase()))
          .map((symptom: string) => ({
            name: symptom.charAt(0).toUpperCase() + symptom.slice(1),
            detected: true
          }));
        
        return [...prevSymptoms, ...newSymptoms];
      });
  
      // Update vitals with validation
      if (detectedVitals) {
        setVitals(prev => {
          const newVitals: Vitals = { ...prev };
          
          // Only update if we have valid values
          if (detectedVitals.temperature?.match(/^\d+(?:\.\d+)?°F$/)) {
            newVitals.temperature = detectedVitals.temperature;
          }
          if (detectedVitals.bloodPressure?.match(/^\d+\/\d+\s*mmHg$/)) {
            newVitals.bloodPressure = detectedVitals.bloodPressure;
          }
          if (detectedVitals.pulse?.match(/^\d+\s*bpm$/)) {
            newVitals.pulse = detectedVitals.pulse;
          }
          
          return newVitals;
        });
      }
  
      setIsAnalyzing(false);
    } catch (error) {
      console.error('Error detecting medical information:', error);
      setError('Failed to analyze medical information');
      setIsAnalyzing(false);
    }
  };

  // Helper function to get the color for lab result flags
  const getFlagColor = (flag: string): string => {
    switch (flag.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-500';
    }
  };

  const abnormalLabResults = labResults.filter(lab => {
    // Make sure flag exists and normalize it
    const flag = lab.flag ? lab.flag.toLowerCase().trim() : '';
    return flag === 'high' || flag === 'low';
  });

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto p-4 overflow-y-auto">
        {/* Patient ID Dropdown */}
        <div className="flex justify-end mb-4">
          <div className="flex items-center">
            <label htmlFor="patient-select" className="mr-2 text-black">Patient ID:</label>
            <select
              id="patient-select"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="bg-white border border-gray-300 rounded-md px-3 py-1 text-black"
            >
              {patientIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left Column - Expandable */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-[#80BCFF]">
                  Current Symptoms
                  {isAnalyzing && <span className="ml-2 text-sm text-gray-500">(Analyzing...)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {symptoms.map((symptom) => (
                    <div 
                      key={symptom.name} 
                      className="p-2 rounded text-black"
                    >
                      {symptom.name}
                    </div>
                  ))}
                  {symptoms.length === 0 && !isAnalyzing && (
                    <div className="text-black">No symptoms detected</div>
                  )}
                  {isAnalyzing && symptoms.length === 0 && (
                    <div className="text-gray-500">Analyzing symptoms...</div>
                  )}
                </div>
              </CardContent>
            </Card>

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
          <div className="md:col-span-2">
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader className="py-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-[#80BCFF]">Live Transcription</CardTitle>
                  <div className="flex gap-2">
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`${isRecording ? 'bg-red-500' : 'bg-green-500'} text-white px-4 py-1 rounded-md flex items-center gap-2`}
                    >
                      <span className={`h-2 w-2 rounded-full bg-white ${isRecording ? 'animate-pulse' : ''}`}></span>
                      {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </button>
                    <button 
                      onClick={resetData}
                      className="bg-gray-500 text-white px-4 py-1 rounded-md flex items-center gap-2"
                      disabled={isRecording}
                    >
                      Reset
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="h-[150px] bg-gray-50 rounded-md p-3 text-black overflow-y-auto">
                    {error ? (
                      <div className="text-red-500">{error}</div>
                    ) : (
                      transcription || "Waiting for audio input..."
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full">
                <div className="m-4 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Lab Results - Show abnormal results with improved display */}
                    <div>
                      <CardTitle className="text-[#80BCFF] mb-2">Abnormal Lab Results</CardTitle>
                      {labTestDate && (
                        <div className="text-sm text-gray-500 mb-2">Test Date: {labTestDate}</div>
                      )}
                      
                      <div className="space-y-2 text-black max-h-[300px] overflow-y-auto pr-2">
                        {abnormalLabResults.length > 0 ? (
                          abnormalLabResults.map((item, index) => {
                            console.log(`Rendering item ${index}:`, item);
                            return (
                              <div key={index} className="flex justify-between items-center mb-1 py-1 border-b">
                                <span className="text-sm font-medium">{item.name}</span>
                                <div className="flex items-center">
                                  <span className={`text-sm mr-2 ${getFlagColor(item.flag || '')}`}>
                                    {item.value}{item.unit ? ` ${item.unit}` : ''}
                                  </span>
                                  <span 
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      item.flag?.toLowerCase().trim() === 'high' 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {item.flag}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div>No abnormal lab results detected ({labResults.length} total lab results available)</div>
                        )}
                      </div>
                      
                      {/* More informative count of normal labs */}
                      {labResults.length > 0 && (
                        <div className="text-xs text-gray-500 mt-2">
                          {labResults.length - abnormalLabResults.length} normal lab results not shown
                          (Debug: {abnormalLabResults.length} abnormal results showing)
                        </div>
                      )}
                    </div>

                    {/* Medical History - Keeping only active conditions and medications in the UI */}
                    <div>
                      <CardTitle className="text-[#80BCFF] mb-4">Medical History</CardTitle>
                      <div className="max-h-[300px] overflow-y-auto pr-2">
                        <div className="mb-4">
                          <h4 className="text-black font-bold mb-2">Active Conditions</h4>
                          {medicalHistory.activeConditions.map((item, index) => (
                            <div key={index} className="bg-gray-50 mb-2 p-2 rounded">
                              <div className="text-sm font-medium text-black">{item.condition}</div>
                              <div className="text-xs text-black">Diagnosed: {item.date}</div>
                            </div>
                          ))}
                        </div>

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
                  <div className="flex justify-end mt-8">
                    <button 
                      onClick={() => {
                        // Store ALL medical data for diagnosis, including all lab results
                        const currentData: DiagnosisResult = {
                          diagnoses: [],
                          symptoms: symptoms.map(s => s.name),
                          vitals: vitals,
                          medicalHistory: medicalHistory,  // Store the full medical history
                          labResults: labResults,          // Store ALL lab results, not just abnormal ones
                          labTestDate: labTestDate         // Store test date
                        };
                        storeCurrentDiagnosis(currentData);
                        
                        // Convert symptoms array to URL-friendly format
                        const symptomsParam = encodeURIComponent(symptoms.map(s => s.name).join(','));
                        // Add the patient ID as a query parameter
                        router.push(`/scan?symptoms=${symptomsParam}&patientId=${selectedPatientId}`);
                      }}
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
      </div>
    </main>
  )
}