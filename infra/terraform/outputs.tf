output "public_ip_address" {
  description = "IP pública estática para api-cartrune.duckdns.org."
  value       = azurerm_public_ip.cartrune.ip_address
}

output "ssh_command" {
  value = "ssh ${var.admin_username}@${azurerm_public_ip.cartrune.ip_address}"
}

output "api_url" {
  value = "https://${var.domain}"
}

output "vm_id" {
  value = azurerm_linux_virtual_machine.cartrune.id
}
