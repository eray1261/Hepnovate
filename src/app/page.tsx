//new version
"use client"

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/card"
import { useRouter } from "next/navigation"
import { parse } from "csv-parse"


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
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
    activeConditions: [],
    currentMedication: [],
  })
  const records: PatientRecord[] = [];

  useEffect(() => {
    websocketRef.current = new WebSocket('ws://localhost:3001')
    
    websocketRef.current.onopen = () => {
      console.log('WebSocket connected')
    }

    websocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.channel?.alternatives[0]?.transcript) {
        const newTranscript = data.channel.alternatives[0].transcript
        setTranscription(prev => prev + ' ' + newTranscript)
        detectSymptomsAndVitals(newTranscript)
      }
    }

    websocketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
      setError('Connection error. Please try again.')
    }

    websocketRef.current.onclose = () => {
      console.log('WebSocket disconnected')

      
    }

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    const loadCSVData = async () => {
        try {
            // Load Lab Results - keep this part the same
            const labResultsResponse = await fetch('/data/lab_results.csv');
            if (!labResultsResponse.ok) {
                console.error("Failed to load lab results:", labResultsResponse.status);
                return;
            }
            const labResultsCSV = await labResultsResponse.text();

            parse(labResultsCSV, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }, (err, records: Array<{ [key: string]: string }>) => {
                if (err) {
                    console.error("Lab Results parsing error:", err);
                    return;
                }

                const selectedPatientData = records.find(patient => patient['Patient ID'] === selectedPatientId);

                if (selectedPatientData) {
                    const patientLabResults: LabResult[] = Object.entries(selectedPatientData)
                        .filter(([key]) => key !== 'Patient ID')
                        .map(([name, value]) => ({ 
                            name, 
                            value: String(value).trim(), 
                            unit: '' 
                        }));

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
            }>) => {
                if (err) {
                    console.error("Medical History parsing error:", err);
                    return;
                }

                const selectedPatientData = records.find(record => record['Patient ID'] === selectedPatientId);

                if (selectedPatientData) {
                    // Parse Active Conditions
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

                    // Parse Current Medications
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

                    setMedicalHistory({
                        activeConditions: conditions,
                        currentMedication: medications
                    });
                } else {
                    console.log("Patient data not found for ID:", selectedPatientId);
                    setMedicalHistory({
                        activeConditions: [],
                        currentMedication: []
                    });
                }
            });

        } catch (error) {
            console.error("Error loading CSVs:", error);
        }
    };

    loadCSVData();
}, [selectedPatientId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(event.data)
        }
      }

      mediaRecorderRef.current.start(1000)
      setIsRecording(true)
      setError(null)
      setTranscription('')
      setSymptoms([])
      setVitals({})
    } catch (err) {
      setError("Failed to start recording. Please check your microphone permissions.")
      console.error("Recording error:", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const detectSymptomsAndVitals = async (transcript: string) => {
    try {
      setIsAnalyzing(true)
      
      const response = await fetch('/api/detect-symptoms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript })
      })
  
      if (!response.ok) throw new Error('Failed to detect medical information')
      
      const { symptoms: detectedSymptoms, vitals: detectedVitals } = await response.json()
      
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
      })
  
      // Update vitals with validation
      if (detectedVitals) {
        setVitals(prev => {
          const newVitals: Vitals = { ...prev }
          
          // Only update if we have valid values
          if (detectedVitals.temperature?.match(/^\d+(?:\.\d+)?°F$/)) {
            newVitals.temperature = detectedVitals.temperature
          }
          if (detectedVitals.bloodPressure?.match(/^\d+\/\d+\s*mmHg$/)) {
            newVitals.bloodPressure = detectedVitals.bloodPressure
          }
          if (detectedVitals.pulse?.match(/^\d+\s*bpm$/)) {
            newVitals.pulse = detectedVitals.pulse
          }
          
          return newVitals
        })
      }
  
      setIsAnalyzing(false)
    } catch (error) {
      console.error('Error detecting medical information:', error)
      setError('Failed to analyze medical information')
      setIsAnalyzing(false)
    }
  }
  return (
    <main className="h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto p-4 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 h-full">
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
                <div className="space-y-2">
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

          {/* Right Column - Fixed */}
          <div className="col-span-2 h-full overflow-hidden">
            <div className="flex flex-col gap-4 h-full">
              <Card>
                <CardHeader className="py-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-[#80BCFF]">Live Transcription</CardTitle>
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`${isRecording ? 'bg-red-500' : 'bg-green-500'} text-white px-4 py-1 rounded-md flex items-center gap-2`}
                  >
                    <span className={`h-2 w-2 rounded-full bg-white ${isRecording ? 'animate-pulse' : ''}`}></span>
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </button>
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

              <Card className="w-full flex-1 overflow-hidden">
                <div className="m-4 p-4">
                  <div className="grid grid-cols-2 gap-8">
                    {/* Lab Results */}
                    <div>
                      <CardTitle className="text-[#80BCFF] mb-4">Recent Lab Results</CardTitle>
                      <div className="space-y-2 text-black">
                        {labResults && labResults.length > 0 ? (
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
                        ) : (
                          <div>Loading lab results...</div>
                        )}
                      </div>
                    </div>

                    {/* Medical History */}
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
      </div>
    </main>
  )
}