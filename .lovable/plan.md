

## Plan de Implementacion

Se realizaran 3 cambios principales:

### 1. Filtro de busqueda en el selector de impresoras de Piezas

Actualmente, el dialogo "Instalar Pieza" en la pagina de Piezas usa un `Select` simple sin busqueda. Se agregara un campo de texto `Input` arriba del selector para filtrar impresoras por nombre, serie o modelo, siguiendo el mismo patron que ya existe en RegistroUso.

**Archivo:** `src/pages/Piezas.tsx`
- Agregar estado `printerSearch` para el texto del filtro
- Crear lista `filteredImpresoras` usando `useMemo` que filtre por nombre, serie o modelo
- Agregar un `Input` de busqueda antes del `Select` de impresora en el formulario de "Registrar Nueva Pieza"
- Mostrar nombre, serie y modelo en cada opcion del selector
- Limpiar el filtro al cerrar el dialogo (en `resetForm`)

### 2. Nombre de empresa personalizable en Configuraciones y PDFs

Agregar un campo en Configuraciones para definir el nombre de la empresa, que se mostrara en el encabezado de todos los PDFs.

**Archivo:** `src/lib/pdfHeader.ts`
- Agregar funciones `saveCorporateName`, `getCorporateName`, `removeCorporateName` usando localStorage
- Modificar `addPDFHeader` para mostrar el nombre de empresa debajo del titulo si esta configurado

**Archivo:** `src/pages/Configuraciones.tsx`
- Agregar una seccion "Nombre de Empresa" con un campo de texto y boton de guardar, dentro de la tarjeta de Logo Corporativo o como tarjeta separada
- Usar las funciones de localStorage para persistir el nombre

### 3. Verificaciones del Dashboard y logo en PDFs

El Dashboard ya muestra nombre y modelo en "Mayor Consumo" (lineas 345-346). El logo en PDFs ya esta implementado en `pdfHeader.ts`. Ambas funcionalidades estan correctamente integradas, no requieren cambios.

---

### Detalle tecnico

**Piezas.tsx - Filtro de busqueda:**
```text
- Nuevo estado: const [printerSearch, setPrinterSearch] = useState('')
- Nuevo memo: filteredImpresoras filtra por nombre/serie/modelo (toLowerCase includes)
- Input de busqueda antes del Select de impresora
- resetForm limpia printerSearch
```

**pdfHeader.ts - Nombre empresa:**
```text
- COMPANY_NAME_KEY = 'corporate_company_name'
- saveCorporateName(name) / getCorporateName() / removeCorporateName()
- addPDFHeader muestra el nombre como subtitulo adicional si existe
```

**Configuraciones.tsx - UI empresa:**
```text
- Estado companyName inicializado desde getCorporateName()
- Input + boton guardar en seccion de personalizacion
- Llama saveCorporateName al guardar
```

