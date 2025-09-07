#!/usr/bin/env python3

"""
Diagram Generation Script for Macro AI Deployment Strategy
Generates architecture diagrams using the diagrams library
"""

import os
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, os.getcwd())

def generate_current_hobby_architecture():
    """Generate diagram of current EC2-based hobby deployment"""
    try:
        from diagrams import Diagram, Cluster, Edge
        from diagrams.aws.compute import ECS, EC2
        from diagrams.aws.network import ELB, VPC, InternetGateway, NATGateway
        from diagrams.aws.database import RDS, ElastiCache
        from diagrams.aws.security import IAM, Cognito
        from diagrams.aws.management import ParameterStore
        from diagrams.aws.general import Users

        with Diagram("Current Hobby Deployment Architecture", show=False, direction="TB"):
            # Users
            users = Users("End Users")

            # AWS Services
            igw = InternetGateway("Internet Gateway")

            with Cluster("VPC"):
                # Network Layer
                public_subnet = NATGateway("Public Subnet\n(ELB + NAT)")
                private_subnet = EC2("Private Subnet\n(EC2 Instances)")

                # Load Balancer
                alb = ELB("Application Load Balancer")

                # Compute Layer
                ec2_asg = EC2("EC2 Auto Scaling Group")

                # Data Layer
                rds = RDS("RDS PostgreSQL")
                redis = ElastiCache("ElastiCache Redis")

                # Configuration
                param_store = ParameterStore("Parameter Store")

            # External Services
            cognito = Cognito("AWS Cognito")
            # Removed S3 for simplicity

            # Connections
            users >> igw >> public_subnet
            public_subnet >> alb
            alb >> private_subnet
            private_subnet >> ec2_asg
            ec2_asg >> Edge(color="blue", style="dashed") >> rds
            ec2_asg >> Edge(color="red", style="dashed") >> redis
            ec2_asg >> Edge(color="green", style="dashed") >> param_store
            ec2_asg >> Edge(color="orange", style="dashed") >> cognito

        print("✅ Generated: Current Hobby Deployment Architecture")
        return True
    except Exception as e:
        print(f"❌ Failed to generate current hobby architecture: {e}")
        return False

def generate_consolidated_architecture():
    """Generate diagram of consolidated ECS + external services"""
    try:
        from diagrams import Diagram, Cluster, Edge
        from diagrams.aws.compute import ECS, Fargate
        from diagrams.aws.network import ELB
        from diagrams.aws.security import IAM, Cognito, SecretsManager
        from diagrams.aws.storage import S3
        from diagrams.aws.management import Cloudwatch
        from diagrams.onprem.database import PostgreSQL
        from diagrams.onprem.inmemory import Redis
        from diagrams.onprem.client import Users

        with Diagram("Consolidated ECS + External Services Architecture", show=False, direction="TB"):
            # Users
            users = Users("End Users")

            # External Services (Free Tier)
            with Cluster("External Services (Free Tier)"):
                neon = PostgreSQL("Neon PostgreSQL\n(Free - 1GB)")
                upstash = Redis("Upstash Redis\n(Free - 30MB)")

            with Cluster("AWS Infrastructure (Minimal Cost)"):
                # Network Layer
                alb = ELB("Application Load Balancer")

                # ECS Cluster
                with Cluster("ECS Fargate Cluster"):
                    ecs_service = ECS("ECS Service")
                    fargate_tasks = Fargate("Fargate Tasks\n(API + UI)\n256MB/512MB")

                # Configuration Layer
                secrets_mgr = SecretsManager("AWS Secrets Manager")

            # Supporting Services
            cognito = Cognito("AWS Cognito")
            s3 = S3("S3 Storage")
            cloudwatch = Cloudwatch("CloudWatch\n(Monitoring)")
            iam = IAM("IAM Roles")

            # Connections
            users >> alb
            alb >> ecs_service
            ecs_service >> fargate_tasks

            # Data connections to external services
            fargate_tasks >> Edge(color="blue", style="solid", label="Neon DB") >> neon
            fargate_tasks >> Edge(color="red", style="solid", label="Upstash Redis") >> upstash

            # AWS service connections
            fargate_tasks >> Edge(color="green", style="dashed") >> secrets_mgr
            fargate_tasks >> Edge(color="orange", style="dashed") >> cognito
            fargate_tasks >> Edge(color="purple", style="dashed") >> s3
            fargate_tasks >> Edge(color="brown", style="dashed") >> iam

            # Monitoring
            fargate_tasks >> Edge(color="gray", style="dotted") >> cloudwatch

        print("✅ Generated: Consolidated ECS + External Services Architecture")
        return True
    except Exception as e:
        print(f"❌ Failed to generate consolidated architecture: {e}")
        return False

def generate_future_scaling_architecture():
    """Generate diagram of future scaling architecture"""
    try:
        from diagrams import Diagram, Cluster, Edge
        from diagrams.aws.compute import ECS, Fargate
        from diagrams.aws.network import ELB, CloudFront
        from diagrams.aws.security import WAF, Shield
        from diagrams.aws.management import Cloudwatch
        from diagrams.aws.storage import S3
        from diagrams.onprem.database import PostgreSQL
        from diagrams.onprem.inmemory import Redis
        from diagrams.onprem.client import Users

        with Diagram("Future Scaling Architecture", show=False, direction="TB"):
            # Users
            users = Users("End Users")

            # Edge Services
            cloudfront = CloudFront("CloudFront CDN")
            waf = WAF("AWS WAF")
            shield = Shield("AWS Shield")

            # Load Balancer Layer
            alb = ELB("Application Load Balancer")

            # ECS Cluster with Scaling
            with Cluster("ECS Fargate Cluster (Auto-Scaled)"):
                with Cluster("API Service"):
                    api_tasks = Fargate("API Tasks\n(2-10 instances)")

                with Cluster("UI Service"):
                    ui_tasks = Fargate("UI Tasks\n(2-5 instances)")

            # External Database Layer (Scalable)
            with Cluster("External Database Services"):
                neon_primary = PostgreSQL("Neon Primary\n(Production Branch)")
                neon_replicas = PostgreSQL("Neon Read Replicas\n(Auto-created)")
                upstash_redis = Redis("Upstash Redis\n(Scaled Instance)")

            # Storage & Monitoring
            s3 = S3("S3 Storage")
            cloudwatch = Cloudwatch("CloudWatch Monitoring")

            # Connections
            users >> cloudfront
            cloudfront >> waf
            waf >> shield
            shield >> alb

            alb >> api_tasks
            alb >> ui_tasks

            # Database connections with branching
            api_tasks >> Edge(color="blue", style="solid", label="Primary DB") >> neon_primary
            api_tasks >> Edge(color="blue", style="dashed", label="Read Replicas") >> neon_replicas
            api_tasks >> Edge(color="red", style="solid", label="Redis Cache") >> upstash_redis

            ui_tasks >> Edge(color="green", style="dashed") >> s3

            # Monitoring connections
            api_tasks >> Edge(color="gray", style="dotted") >> cloudwatch
            ui_tasks >> Edge(color="gray", style="dotted") >> cloudwatch

            # Scaling indicators
            Edge(label="Auto Scale\n2-10 tasks", color="orange", style="dashed") >> api_tasks
            Edge(label="Auto Scale\n2-5 tasks", color="orange", style="dashed") >> ui_tasks

            # Neon branching visualization
            Edge(label="Auto-branching", color="purple", style="dotted") >> neon_replicas

        print("✅ Generated: Future Scaling Architecture")
        return True
    except Exception as e:
        print(f"❌ Failed to generate future scaling architecture: {e}")
        return False

def generate_corrected_neon_branching():
    """Generate corrected Neon database branching strategy diagram"""
    try:
        from diagrams import Diagram, Cluster, Edge
        from diagrams.onprem.database import PostgreSQL
        from diagrams.aws.compute import ECS, Fargate
        from diagrams.onprem.client import Client
        from diagrams.generic.blank import Blank

        with Diagram("Corrected Neon Database Branching Strategy", show=False, direction="LR"):
            # Production Database (Parent)
            prod_db = PostgreSQL("Production DB\n(Main Branch)\n- Live data\n- Latest schema\n- pgvector enabled")

            # Staging Database (Branch from Production)
            staging_db = PostgreSQL("Staging DB\n(Branch from Production)\n- Pre-deployment testing\n- Schema validation")

            # Feature Database (Branch from Staging)
            feature_db = PostgreSQL("Feature DB\n(Branch from Staging)\n- Feature development\n- Isolated testing")

            # Development (Local)
            dev_client = Client("Development\n(Localhost)\n- Uses branch DB\n- Based on git branch")

            # Deployment pipeline
            with Cluster("Deployment Pipeline"):
                blank1 = Blank("Feature\nDeployment")
                blank2 = Blank("Staging\nValidation")
                blank3 = Blank("Production\nRelease")

            # ECS Services
            with Cluster("ECS Services"):
                feature_ecs = Fargate("Feature\nECS Tasks")
                staging_ecs = Fargate("Staging\nECS Tasks")
                prod_ecs = Fargate("Production\nECS Tasks")

            # Branching connections (corrected flow)
            prod_db >> Edge(color="red", style="solid", label="Auto-branch") >> staging_db
            staging_db >> Edge(color="blue", style="solid", label="Auto-branch") >> feature_db

            # Schema sync connections (bidirectional)
            staging_db >> Edge(color="red", style="dashed", label="Schema sync") >> prod_db
            feature_db >> Edge(color="blue", style="dashed", label="Schema sync") >> staging_db

            # Development connections
            dev_client >> Edge(color="green", style="solid", label="Local dev") >> feature_db
            dev_client >> Edge(color="orange", style="solid", label="Local staging") >> staging_db

            # ECS connections
            feature_ecs >> Edge(color="blue", style="solid") >> feature_db
            staging_ecs >> Edge(color="red", style="solid") >> staging_db
            prod_ecs >> Edge(color="purple", style="solid") >> prod_db

            # Deployment flow
            feature_db >> blank1
            blank1 >> staging_db
            blank1 >> blank2
            blank2 >> prod_db
            blank2 >> blank3

        print("✅ Generated: Corrected Neon Database Branching Strategy")
        return True
    except Exception as e:
        print(f"❌ Failed to generate corrected Neon branching: {e}")
        return False

def main():
    """Main function to generate all diagrams"""
    print("🚀 Starting diagram generation...")

    # Create diagrams directory if it doesn't exist
    diagrams_dir = Path("docs/diagrams")
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    # Change to diagrams directory for output
    os.chdir(diagrams_dir)

    # Generate all diagrams
    results = []
    results.append(("Current Hobby Architecture", generate_current_hobby_architecture()))
    results.append(("Consolidated Architecture", generate_consolidated_architecture()))
    results.append(("Future Scaling Architecture", generate_future_scaling_architecture()))
    results.append(("Corrected Neon Branching", generate_corrected_neon_branching()))

    # Print results
    print("\n📊 Generation Results:")
    successful = 0
    for name, success in results:
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"  {name}: {status}")
        if success:
            successful += 1

    print(f"\n📁 Generated {successful}/{len(results)} diagrams successfully")
    print(f"📂 Diagrams saved to: {diagrams_dir.absolute()}")

    # List generated files
    png_files = list(diagrams_dir.glob("*.png"))
    if png_files:
        print("\n📄 Generated files:")
        for file in png_files:
            print(f"  - {file.name}")

    return successful == len(results)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
