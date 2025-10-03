import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import { procesarMensaje } from './botLogic.js';

const app = express();
const PORT = process.env.PORT || 3000;


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


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


export const userStates = new Map();

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


app.post('/webhook', async (req, res) => {
  try {
    const incomingMessage = req.body.Body || '';
    const fromNumber = req.body.From.replace('whatsapp:', '');
    const toNumber = req.body.To;
    
    console.log(`\n📩 Mensaje recibido de ${fromNumber}: "${incomingMessage}"`);
    
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
    }
    
    const userState = userStates.get(fromNumber);
    const respuesta = await procesarMensaje(incomingMessage, userState, fromNumber);
    
    if (respuesta) {
        await enviarMensajeWhatsApp(fromNumber, respuesta);
    }
    userStates.set(fromNumber, userState);
    res.status(200).send('OK');
    } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    res.status(500).send('Error interno del servidor');
}
});


app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'WhatsApp Bot está funcionando',
    activeUsers: userStates.size,
    timestamp: new Date().toISOString()
  });
});


app.get('/', (req, res) => {
  res.send(`
    <h1>🤖 WhatsApp Shopping Bot</h1>
    <p>El bot está activo y funcionando.</p>
    <p>Usuarios activos: ${userStates.size}</p>
    <p><a href="/health">Ver estado del servidor</a></p>
  `);
});


app.listen(PORT, () => {
  console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n✅ Bot listo para recibir mensajes de WhatsApp\n`);
});


process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});