# Terraform para Azure

Esta configuración crea solamente la infraestructura de CartRune:

- VNet, subnet y NSG.
- IP pública estática para `api-cartrune.duckdns.org`.
- VM Ubuntu 22.04 Gen2 `Standard_B2ats_v2`.
- Disco OS `Standard_LRS` de 30 GB.
- Docker y Docker Compose v2 mediante cloud-init.

No crea PostgreSQL, Supabase, Qdrant, Ollama ni un registro de contenedores. La aplicación usa Supabase externo y el CD de la aplicación publica la imagen en GHCR y la actualiza por SSH.

## Primer despliegue

### Autenticación local

Para trabajar desde tu equipo, Terraform usa la sesión de Azure CLI:

```bash
az login --tenant TENANT_ID
az account set --subscription SUBSCRIPTION_ID
az account show --output table
```

No pongas un `client_secret`, contraseña ni clave privada dentro de los archivos Terraform.

### Crear el estado remoto

El Storage Account del estado debe existir antes de `terraform init`. Puedes crearlo dentro del resource group existente:

```bash
az storage account create \
  --name NOMBRE_UNICO_SOLO_MINUSCULAS \
  --resource-group cartrune-rg-chile \
  --location chilecentral \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --min-tls-version TLS1_2

STORAGE_ID=$(az storage account show \
  --name NOMBRE_UNICO_SOLO_MINUSCULAS \
  --resource-group cartrune-rg-chile \
  --query id --output tsv)

USER_OBJECT_ID=$(az ad signed-in-user show --query id --output tsv)
az role assignment create \
  --assignee-object-id "$USER_OBJECT_ID" \
  --assignee-principal-type User \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID"

az storage container create \
  --name tfstate \
  --account-name NOMBRE_UNICO_SOLO_MINUSCULAS \
  --auth-mode login
```

Si la asignación de roles falla, necesitas permisos `Owner` o `User Access Administrator` sobre el resource group. Espera unos minutos después de asignar el rol para que Azure propague los permisos.

### Inicializar Terraform

```bash
cd infra/terraform
cp backend.hcl.example backend.hcl
# Cambia el nombre de la cuenta en backend.hcl.
terraform init -backend-config=backend.hcl
```

`terraform init` sólo configura el provider y el estado; no modifica recursos.

### Desplegar o adoptar recursos

Si los recursos ya existen, impórtalos antes de aplicar. Si sólo existe el resource group, puedes continuar con `plan`:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edita terraform.tfvars con tu clave pública SSH y tu CIDR de administración.
terraform plan -var-file=terraform.tfvars
```

Revisa el plan. No ejecutes `apply` si muestra reemplazos o eliminaciones inesperadas.

```bash
terraform fmt -recursive
terraform validate
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
terraform output public_ip_address
```

Actualiza el registro A de DuckDNS con `public_ip_address`. Después espera a que cloud-init termine. El despliegue de la aplicación se gestiona con [apps/deploy](../../apps/deploy/README.md) y `.github/workflows/cd.yml`.

## CI/CD de infraestructura

El workflow `.github/workflows/terraform.yml` usa GitHub OIDC. Requiere una aplicación de Microsoft Entra con federated credentials para el repositorio y estos secretos: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `TFSTATE_RESOURCE_GROUP`, `TFSTATE_STORAGE_ACCOUNT`, `TF_VAR_ADMIN_SSH_PUBLIC_KEY` y `TF_VAR_ADMIN_SOURCE_CIDR`. El apply ocurre únicamente al hacer push a `master`; los pull requests sólo generan plan.
