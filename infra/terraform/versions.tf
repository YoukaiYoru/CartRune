terraform {
  required_version = ">= 1.8.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.56"
    }
  }

  # El estado remoto evita que CI/CD dependa del equipo local.
  # Crea el Storage Account indicado en README.md antes de ejecutar init.
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
}
