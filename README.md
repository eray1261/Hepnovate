# Hepnovate UI Project 

## What is Hepnovate?

Hepnovate helps doctors diagnose liver diseases by combining AI with medical expertise. It works in three simple steps:

First, it listens to patient-doctor conversations to capture symptoms and pulls in recent lab results. Doctors can review and modify the suggested diagnoses before moving forward.

Next, doctors can explore relevant imaging scans, highlight important areas, and add notes. The system uses these annotated images along with the clinical data for deeper analysis.

Finally, Hepnovate offers potential diagnoses with confidence scores and explains its reasoning with citations. Doctors remain in control, able to select multiple diagnoses, ask for refinements, or provide feedback to improve results.

Once the physician confirms a diagnosis, the system automatically generates a comprehensive medical write-up following standard clinical templates, saving documentation time while ensuring thorough reporting.

The tool doesn't replace medical judgment – it enhances it by helping physicians process complex information more efficiently.

[Watch Demo Video](https://www.youtube.com/watch?v=8Gkz0i7MShA)

## Getting Started

### What You Need
- **Node.js** (version 18 or higher)
- **npm** (version 9 or higher)
- **Git**

### How to Install

1. **Clone the repository**: This means you will make a copy of the project on your computer.
   ```bash
   git clone https://github.com/eray1261/Hepnovate.git
2. **Go to the project folder**:
   ```bash
   cd Hepnovate
3. **Install the necessary packages**: This will download everything you need to run the project.
   ```bash
   npm install

## Running the Project

1. **Start the server**: This will run the application on your computer.
   ```bash
   npm run dev
2. **Open the application**: Go to your web browser and type in `http://localhost:3001` to see the app.

## How to Use the Application

* Go to the **Diagnosis** page to check patient data.
* Use the **Scan** page to see diagnostic images.
* The **Writeup** section generates medical reports after diagnosis confirmation.

## API Endpoints

* **POST /api/detect-symptoms**: Extracts symptoms from conversation text and returns detected symptoms and vital signs.
* **POST /api/saveImage**: Saves annotated image scans to the database.
* **POST /api/diagnose**: Analyzes medical data and provides diagnoses with confidence scores.
* **POST /api/get-deepgram-token**: Handles authentication for conversation analysis.
* **POST /api/writeup**: Generates standardized medical reports based on confirmed diagnoses.

## Project Structure

* `src/app/`: Contains main application pages and routing logic.
* `src/app/api/`: API route handlers for backend functionality.
* `src/app/diagnosis/`: Components for the diagnosis workflow.
* `src/app/scan/`: Components for medical image viewing and annotation.
* `src/app/writeup/`: Components for medical report generation.
* `src/components/`: Reusable UI components used across the application.
* `epic_data/`: Contains sample medical data for demonstration.
* `public/`: Static assets and resources.
