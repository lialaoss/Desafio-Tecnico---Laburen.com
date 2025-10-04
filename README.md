# 🤖 Agente de IA para E-commerce con WhatsApp

Este proyecto implementa una solución de **Agente de Inteligencia Artificial Conversacional** diseñada para gestionar consultas y ventas de un catálogo de productos a través de WhatsApp.

Cumple con el requisito clave de ser un Agente de IA capaz de **entender el lenguaje natural y ejecutar solicitudes HTTP (API REST)**, superando el modelo tradicional de bot de menús.

---

## 🌐 Arquitectura del Microservicio

La solución se divide en dos microservicios independientes desplegados en Render:

* **`api`**: Servidor **API RESTful** para la gestión de productos y carritos de compra (Base de Datos y CRUD).
* **`bot-whatsapp`**: Servidor **Webhook** que aloja el Agente de IA, recibe mensajes de Twilio y ejecuta la lógica de negocio.

### Tecnologías Clave

| Componente | Tecnología | Rol |
| :--- | :--- | :--- |
| **Agente de IA** | `Google Gemini (API)` | Clasifica la intención del usuario y extrae parámetros de la solicitud. |
| **Backend API** | `Node.js`, `Express`, `Prisma` | Provee los *endpoints* HTTP para la gestión de datos. |
| **Base de Datos** | `SQLite / PostgreSQL` | Almacena productos (cargados desde `products.xlsx`) y carritos de compra. |
| **Gateway** | `Twilio for WhatsApp` | Conecta la plataforma de mensajería con el Webhook. |

---

## ⚙️ Requisitos Técnicos

* **Node.js** (versión ≥ 18)
* `npm` (Gestor de paquetes)
* **Twilio** (con Sandbox de WhatsApp configurado)
* Clave de **Google Gemini API**
* Una plataforma de despliegue (Render)

---

## 💻 Endpoints de la API RESTful

El Agente de IA consume estos *endpoints* para interactuar con el catálogo de productos y gestionar el carrito de compra.

| Método | Ruta | Descripción | Uso por el Agente de IA | Códigos HTTP |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/products` | Lista de productos con filtro opcional. | **Listar/Buscar Productos.** El agente lo llama para mostrar el catálogo completo o filtrar resultados (`?q=pantalones`). | 200, 500 |
| **GET** | `/products/:id` | Detalle de un producto específico. | **Detalle de Producto.** Usado para obtener información completa (precio, stock) antes de agregarlo al carrito. | 200, 404 |
| **POST** | `/carts` | Creación de un nuevo carrito. | **Crear Carrito.** Se llama al detectar la intención inicial de compra, enviando los primeros ítems. | 201, 404 |
| **PATCH** | `/carts/:id` | Actualización o eliminación de ítems en el carrito. | **Editar Carrito.** Usado para actualizar cantidades o remover productos del carrito. | 200, 404 |
| **GET** | `/carts/:id` | Consulta del contenido de un carrito. | **Consultar Carrito.** Usado para mostrar al usuario el resumen del carrito o verificar su estado. | 200, 404 |

### Rutas de Búsqueda Clave

* **`/products`**: Ruta principal que maneja el catálogo. El parámetro opcional `?q=` es clave para que el Agente de IA pueda realizar búsquedas con lenguaje natural.
* **`/carts`**: La ruta base para la gestión de carritos. Se usa con **POST** para la creación, y luego con **PATCH** y **GET** apuntando al ID del carrito.

---

## ⚠️ Nota de Producción y Testing

Debido a las limitaciones del entorno gratuito (Render) y del *sandbox* de Twilio:

1.  **Persistencia de Datos:** Los productos son cargados exitosamente de `products.xlsx` al inicio del servidor. Sin embargo, en el *free tier* de Render, esta base de datos es volátil y **se resetea** en cada reinicio.
2.  **Testing de WhatsApp:** La conexión con WhatsApp está limitada por el *sandbox* de Twilio a un número reducido de mensajes (9 mensajes por día), lo que limita la abundancia de pruebas en vivo. Igualmente el número contectado con los servidores es: +14155238886 y el acceso al bot se da con la palabra: join pond-garage

A pesar de estas limitaciones, la arquitectura es **funcional 24/7** y el consumo HTTP del Agente de IA ha sido **verificado** con éxito directamente en los *endpoints* públicos de la API.
