variable "resource_group_name" {
  description = "Resource group existente donde se desplegará CartRune."
  type        = string
  default     = "cartrune-rg-chile"
}

variable "location" {
  description = "Región de Azure; debe coincidir con el resource group existente."
  type        = string
  default     = "chilecentral"
}

variable "vm_name" {
  type    = string
  default = "cartrune-vm"
}

variable "vm_size" {
  type    = string
  default = "Standard_B2ats_v2"
}

variable "admin_username" {
  type    = string
  default = "cartrune"
}

variable "admin_ssh_public_key" {
  description = "Contenido de la clave pública SSH, no la privada."
  type        = string
  sensitive   = true
}

variable "admin_source_cidr" {
  description = "CIDR desde el que se permite SSH. Usa tu IP/32."
  type        = string
}

variable "os_disk_size_gb" {
  type    = number
  default = 30
}

variable "domain" {
  type    = string
  default = "api-cartrune.duckdns.org"
}

variable "environment" {
  type    = string
  default = "production"
}
