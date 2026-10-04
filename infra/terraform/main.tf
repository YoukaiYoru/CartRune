data "azurerm_resource_group" "cartrune" {
  name = var.resource_group_name
}

resource "azurerm_virtual_network" "cartrune" {
  name                = "cartrune-vmVNET"
  location            = data.azurerm_resource_group.cartrune.location
  resource_group_name = data.azurerm_resource_group.cartrune.name
  address_space       = ["10.0.0.0/16"]

  tags = local.tags
}

resource "azurerm_subnet" "cartrune" {
  name                 = "cartrune-vmSubnet"
  resource_group_name  = data.azurerm_resource_group.cartrune.name
  virtual_network_name = azurerm_virtual_network.cartrune.name
  address_prefixes     = ["10.0.0.0/24"]
}

resource "azurerm_public_ip" "cartrune" {
  name                = "cartrune-vmPublicIP"
  location            = data.azurerm_resource_group.cartrune.location
  resource_group_name = data.azurerm_resource_group.cartrune.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = local.tags
}

resource "azurerm_network_security_group" "cartrune" {
  name                = "cartrune-vmNSG"
  location            = data.azurerm_resource_group.cartrune.location
  resource_group_name = data.azurerm_resource_group.cartrune.name

  security_rule {
    name                       = "allow-ssh-admin"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.admin_source_cidr
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-http"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-https"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.tags
}

resource "azurerm_network_interface" "cartrune" {
  name                = "cartrune-vmVMNic"
  location            = data.azurerm_resource_group.cartrune.location
  resource_group_name = data.azurerm_resource_group.cartrune.name

  ip_configuration {
    name                          = "ipconfigcartrune-vm"
    subnet_id                     = azurerm_subnet.cartrune.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.cartrune.id
  }

  tags = local.tags
}

resource "azurerm_network_interface_security_group_association" "cartrune" {
  network_interface_id      = azurerm_network_interface.cartrune.id
  network_security_group_id = azurerm_network_security_group.cartrune.id
}

resource "azurerm_linux_virtual_machine" "cartrune" {
  name                            = var.vm_name
  resource_group_name             = data.azurerm_resource_group.cartrune.name
  location                        = data.azurerm_resource_group.cartrune.location
  size                            = var.vm_size
  admin_username                  = var.admin_username
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.cartrune.id]
  custom_data                     = base64encode(templatefile("${path.module}/cloud-init.yaml", { admin_username = var.admin_username }))

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.admin_ssh_public_key
  }

  os_disk {
    name                 = "cartrune-vm_OsDisk_1_73447c03a89945558b614b7afc05546e"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  lifecycle {
    # Estos valores pertenecen a la VM ya existente. Cambiarlos puede forzar
    # su reemplazo, por lo que cloud-init y la clave SSH quedan fuera del
    # alcance de este módulo de adopción.
    ignore_changes = [
      custom_data,
      admin_ssh_key,
    ]
  }

  tags = local.tags
}

locals {
  tags = {
    application = "cartrune"
    environment = var.environment
    managed_by  = "terraform"
    domain      = var.domain
  }
}
