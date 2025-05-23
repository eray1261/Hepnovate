// src/services/diagnosisStorage.ts

// Define interfaces
export type Vitals = {
    temperature?: string;
    bloodPressure?: string;
    pulse?: string;
    [key: string]: string | undefined; // Allow for other vitals
  };
  
  export type LabResult = {
    name: string;
    value: string;
    unit: string;
    flag?: string;  // Add flag field for abnormal values
  };
  
  export type MedicalCondition = {
    condition: string;
    date: string;
  };
  
  export type Medication = {
    name: string;
    dosage: string;
  };
  
  export type Surgery = {
    surgery: string;
    date: string;
  };
  
  export type Allergy = {
    allergen: string;
    reaction: string;
  };
  
  export type Immunization = {
    immunization: string;
    date: string;
  };
  
  // Expanded MedicalHistory type
  export type MedicalHistory = {
    activeConditions: MedicalCondition[];
    currentMedication: Medication[];
    pastSurgeries?: Surgery[];
    allergies?: Allergy[];
    socialHistory?: string;
    familyHistory?: string;
    immunizations?: Immunization[];
  };
  
  export type Diagnosis = {
    name: string;
    confidence: number;
    findings: string[];
    differential: string[];
    plan: string[];
    severity: 'Mild' | 'Moderate' | 'Severe';
  };
  
  // Enhanced DiagnosisResult type with additional properties
  export type DiagnosisResult = {
    diagnoses: Diagnosis[];
    imageData?: string;     // Base64 image data
    symptoms?: string[];    // Patient symptoms
    vitals?: Vitals;        // Patient vitals
    labResults?: LabResult[]; // Laboratory results
    labTestDate?: string;   // Date of lab tests
    medicalHistory?: MedicalHistory; // Medical history
    timestamp?: string;     // When diagnosis was created
    rawDiagnosisText?: string; // Raw text from diagnosis model
  };
  
  /**
   * Interface for medical write-up data
   */
  export interface WriteUpData {
    content: string;
    createdAt: string;
    diagnosisId?: string; // Reference to the associated diagnosis
  }
  
  // Local storage keys
  const DIAGNOSIS_STORAGE_KEY = 'currentDiagnosis';
  const WRITEUP_STORAGE_KEY = 'currentWriteUp';
  
  // Store current diagnosis
  export function storeCurrentDiagnosis(diagnosis: DiagnosisResult): void {
    try {
      // Add timestamp if not present
      if (!diagnosis.timestamp) {
        diagnosis.timestamp = new Date().toISOString();
      }
      
      localStorage.setItem(DIAGNOSIS_STORAGE_KEY, JSON.stringify(diagnosis));
    } catch (error) {
      console.error('Error storing diagnosis:', error);
    }
  }
  
  // Get current diagnosis
  export function getCurrentDiagnosis(): DiagnosisResult | null {
    try {
      const data = localStorage.getItem(DIAGNOSIS_STORAGE_KEY);
      if (!data) return null;
      
      return JSON.parse(data) as DiagnosisResult;
    } catch (error) {
      console.error('Error retrieving diagnosis:', error);
      return null;
    }
  }
  
  // Reset diagnosis but keep symptoms
  export function resetDiagnosisKeepSymptoms(): void {
    try {
      const currentData = getCurrentDiagnosis();
      if (!currentData) return;
      
      // Keep only symptoms, vitals, and reset the rest
      const resetData: DiagnosisResult = {
        diagnoses: [],
        symptoms: currentData.symptoms,
        vitals: currentData.vitals,
        labResults: currentData.labResults,
        labTestDate: currentData.labTestDate,
        medicalHistory: currentData.medicalHistory
      };
      
      storeCurrentDiagnosis(resetData);
    } catch (error) {
      console.error('Error resetting diagnosis:', error);
    }
  }
  
  // Clear all diagnosis data
  export function clearDiagnosisData(): void {
    localStorage.removeItem(DIAGNOSIS_STORAGE_KEY);
  }
  
  /**
   * Store the generated write-up content in localStorage
   */
  export function storeWriteUp(writeUp: string, diagnosisId?: string): void {
    try {
      const writeUpData: WriteUpData = {
        content: writeUp,
        createdAt: new Date().toISOString(),
        diagnosisId
      };
      
      localStorage.setItem(WRITEUP_STORAGE_KEY, JSON.stringify(writeUpData));
    } catch (error) {
      console.error('Error storing write-up data:', error);
    }
  }
  
  /**
   * Retrieve the current write-up from localStorage
   */
  export function getCurrentWriteUp(): WriteUpData | null {
    try {
      const writeUpData = localStorage.getItem(WRITEUP_STORAGE_KEY);
      return writeUpData ? JSON.parse(writeUpData) : null;
    } catch (error) {
      console.error('Error retrieving write-up data:', error);
      return null;
    }
  }
  
  /**
   * Clear the write-up data
   */
  export function clearWriteUpData(): void {
    localStorage.removeItem(WRITEUP_STORAGE_KEY);
  }