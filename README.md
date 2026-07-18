# ML Model Deployment Template — GCP & AWS

A production-grade, interactive template and dashboard for deploying Machine Learning models to Google Cloud Platform (GCP) and Amazon Web Services (AWS). It features a complete pipeline: local model training, local containerized serving (FastAPI + Docker), cloud deployment scripts (gcloud, boto3/sagemaker), Infrastructure as Code (Terraform), and a premium frontend monitoring dashboard with a live inference sandbox.

## Project Structure

```text
├── backend/
│   ├── train.py           # Training script for RandomForest classification model
│   ├── main.py            # FastAPI service exposing model endpoints
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile         # Production Docker container definition
├── gcp/
│   ├── deploy_cloud_run.sh# CLI deployment script for Google Cloud Run
│   ├── deploy_vertex.py   # Python SDK script for Google Cloud Vertex AI deployment
│   └── terraform/
│       └── main.tf        # GCP infrastructure provisioning configuration
├── aws/
│   ├── deploy_app_runner.sh# CLI deployment script for AWS App Runner
│   ├── deploy_sagemaker.py # Python SDK script for AWS SageMaker deployment
│   └── terraform/
│       └── main.tf        # AWS infrastructure provisioning configuration
├── index.html             # Dashboard frontend index
├── app.js                 # Dashboard application logic & API client
├── styles.css             # Dashboard styling
└── README.md              # Documentation (This file)
```

---

## 🚀 Quickstart: Local Setup & Running Backend

### 1. Set Up Python Virtual Environment
Navigate to the `backend` folder and initialize a virtual environment:
```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Train Model
Run the training script to generate the model artifacts (`model.joblib`, `scaler.joblib`) and evaluations (`metrics.json`):
```bash
python train.py
```

### 4. Start Model Serving API
Start the FastAPI server locally:
```bash
python main.py
```
The server will boot up on `http://localhost:8080`.
- Access API documentation: `http://localhost:8080/docs`
- Health check: `http://localhost:8080/health`
- Post predictions: `http://localhost:8080/predict`

---

## 🐳 Run Locally via Docker

To containerize the model serving application and verify it before cloud deployment:

### 1. Build Docker Image
```bash
cd backend
docker build -t fraud-detector-api:latest .
```
*(Note: During build, `train.py` executes automatically to bake the model artifacts directly into the image.)*

### 2. Run Container
```bash
docker run -p 8080:8080 fraud-detector-api:latest
```
Test the container on `http://localhost:8080/health`.

---

## ☁️ Deploying to Google Cloud Platform (GCP)

We provide two primary options for GCP deployment:

### Option A: GCP Cloud Run (Containerized Serverless)
Ideal for standard REST APIs with auto-scaling down to zero instances (extremely cost-effective).
1. Configure configurations in `gcp/deploy_cloud_run.sh`.
2. Run the deployment script:
   ```bash
   cd gcp
   ./deploy_cloud_run.sh
   ```

### Option B: GCP Vertex AI Endpoint (Enterprise ML Platform)
Ideal for official model monitoring, model drift tracking, metadata tracking, and model lineage.
1. Authenticate with GCP CLI: `gcloud auth application-default login`.
2. Run the Vertex AI Python deployment script:
   ```bash
   cd gcp
   python deploy_vertex.py
   ```

### Option C: Provisioning with Terraform
Use Terraform to provision Artifact Registry and Cloud Run:
```bash
cd gcp/terraform
terraform init
terraform plan
terraform apply
```

---

## ☁️ Deploying to Amazon Web Services (AWS)

We provide two primary options for AWS deployment:

### Option A: AWS App Runner (Containerized Serverless)
AWS equivalent to Google Cloud Run, allowing rapid container deployments without managing Kubernetes/ECS configurations.
1. Update configurations in `aws/deploy_app_runner.sh`.
2. Execute the script:
   ```bash
   cd aws
   ./deploy_app_runner.sh
   ```

### Option B: AWS SageMaker Endpoint (Enterprise ML Platform)
Official AWS ML platform supporting containerized real-time and batch model serving endpoints.
1. Install AWS Boto3 SDK: `pip install boto3`.
2. Configure AWS credentials: `aws configure`.
3. Deploy model:
   ```bash
   cd aws
   python deploy_sagemaker.py
   ```

### Option C: Provisioning with Terraform
Use Terraform to provision AWS ECR and AWS App Runner:
```bash
cd aws/terraform
terraform init
terraform plan
terraform apply
```

---

## 📊 Frontend Dashboard Integration & Inference Sandbox

The root directory contains a premium frontend interface to monitor active cloud deployments and try out model queries.

### Sandbox Testing Client
When running the dashboard, the page automatically polls `localhost:8080`.
- **Local API Offline**: The sandbox client runs predictions using a **Mock Sandbox API** (heuristics engine running in JavaScript).
- **Local API Online**: The sandbox client automatically redirects queries to the **Local FastAPI server** running on `localhost:8080/predict` and parses the response dynamically, displaying a live inference report!
