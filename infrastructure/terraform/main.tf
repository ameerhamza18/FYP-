# TrustLayer — AWS deployment (demo-sized, single EC2 + docker compose)
# Usage:
#   cd infrastructure/terraform
#   terraform init && terraform apply -var key_name=my-key
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "region" { default = "us-east-1" }
variable "instance_type" { default = "t3.medium" } # 4GB RAM suitable for ML inference & OCR
variable "key_name" { type = string }
variable "admin_ssh_cidr" {
  description = "CIDR block permitted for administrative SSH access"
  type        = string
  default     = "0.0.0.0/0" # In production, restrict to your organization/VPN IP
}

provider "aws" { region = var.region }

resource "aws_security_group" "trustlayer" {
  name_prefix = "trustlayer-"
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_ssh_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "trustlayer" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.trustlayer.id]

  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    apt-get update
    apt-get install -y docker.io docker-compose-v2 certbot nginx
    systemctl enable --now docker
    # Deploy: git clone <repo> /srv/trustlayer
    #         docker compose -f infrastructure/docker/docker-compose.yml up -d
    # TLS:    certbot --nginx -d api.yourdomain.com  (HTTPS termination)
  EOF

  tags = { Name = "trustlayer-api" }
}

output "public_ip" { value = aws_instance.trustlayer.public_ip }
