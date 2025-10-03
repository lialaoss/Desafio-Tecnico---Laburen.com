import express from 'express';
import twilio from 'twilio';
import cors from 'cors';
import { procesarMensaje } from './agent.js';
import productRoutes from './src/routes/productRoutes.js';
import cartRoutes from './src/routes/cartRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MIDDLEWARES CORRECTOS (sin duplicados)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verificar variables de entorno
const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Faltan variables de entorno: ${missingVars.join(', ')}`);
  console.error('Por favor configurá estas variables antes de iniciar el servidor.');
  process.exit(1);
}

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Estado de usuarios
export const userStates = new Map();

// Función para enviar mensajes de WhatsApp
export async function enviarMensajeWhatsApp(toNumber, mensaje) {
  try {
    const message = await twilioClient.messages.create({
      body: mensaje,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${toNumber}`
    });
    
    console.log(`✅ Mensaje enviado a ${toNumber}: ${message.sid}`);
    return message;
  } catch (error) {
    console.error(`❌ Error enviando mensaje a ${toNumber}:`, error.message);
    throw error;
  }
}

// Rutas básicas
app.get('/', (req, res) => {
  res.send(`
    <h1>🤖 WhatsApp Shopping Bot</h1>
    <p>El bot está activo y funcionando.</p>
    <p>Usuarios activos: ${userStates.size}</p>
    <p><a href="/health">Ver estado del servidor</a></p>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'WhatsApp Bot está funcionando',
    activeUsers: userStates.size,
    timestamp: new Date().toISOString()
  });
});

// Webhook de WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    console.log('\n📥 Webhook recibido:', JSON.stringify(req.body, null, 2));
    
    const incomingMessage = req.body.Body || '';
    const fromNumber = req.body.From.replace('whatsapp:', '');
    
    console.log(`\n📩 Mensaje de ${fromNumber}: "${incomingMessage}"`);
    
    // Inicializar estado del usuario si es nuevo
    if (!userStates.has(fromNumber)) {
      userStates.set(fromNumber, {
        currentCartId: null,
        lastProducts: [],
        lastSearchQuery: null,
        phase: 'welcome',
        displayOffset: 0,
        displayLimit: 10,
        waitingForSelection: false
      });
      
      await enviarMensajeWhatsApp(
        fromNumber,
        '👋 ¡Hola! Bienvenido/a a nuestra tienda.\n\n' +
        '¿Qué producto estás buscando hoy?\n\n' +
        'Puedo ayudarte a:\n' +
        '• Buscar productos\n' +
        '• Crear tu carrito\n' +
        '• Darte recomendaciones\n\n' +
        '💡 Ejemplo: "busco pantalones negros"'
      );
      
      res.status(200).send('OK');
      return;
    }
    
    // Procesar el mensaje
    const userState = userStates.get(fromNumber);
    const respuesta = await procesarMensaje(incomingMessage, userState, fromNumber);
    
    if (respuesta) {
      await enviarMensajeWhatsApp(fromNumber, respuesta);
    }
    
    // Actualizar estado
    userStates.set(fromNumber, userState);
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    
    // Intentar informar al usuario del error
    try {
      const fromNumber = req.body.From.replace('whatsapp:', '');
      await enviarMensajeWhatsApp(
        fromNumber, 
        '❌ Ocurrió un error. Por favor intentá de nuevo.'
      );
    } catch (sendError) {
      console.error('❌ No se pudo enviar mensaje de error:', sendError);
    }
    
    res.status(200).send('OK'); // Twilio requiere 200 siempre
  }
});

// Rutas de API
app.use('/products', productRoutes);
app.use('/carts', cartRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`📱 Webhook URL: /webhook`);
  console.log(`🏥 Health check: /health`);
  console.log(`📦 API Products: /products`);
  console.log(`🛒 API Carts: /carts`);
  console.log(`\n✅ Bot listo para recibir mensajes de WhatsApp\n`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});