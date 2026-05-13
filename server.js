import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

console.log('🚀 Iniciando servidor...');
console.log('🔑 TOKEN:', process.env.META_VERIFY_TOKEN);
console.log('🔑 API KEY primeros 20:', process.env.ANTHROPIC_API_KEY?.substring(0, 20));

app.get('/', (req, res) => {
  res.status(200).send('Bot activo ✅');
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const historialUsuarios = new Map();

app.get('/webhook', (req, res) => {
  const modo = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📥 Webhook recibido - modo:', modo, 'token:', token);
  console.log('🔑 Token esperado:', process.env.META_VERIFY_TOKEN);

  if (modo === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Token no coincide');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'instagram') {
    const mensaje = body.entry?.[0]?.messaging?.[0];
    if (mensaje?.message?.text) {
      const userId = mensaje.sender.id;
      const textoUsuario = mensaje.message.text;
      await procesarMensaje(userId, textoUsuario);
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

async function procesarMensaje(userId, textoUsuario) {
  const historial = historialUsuarios.get(userId) || [];
  historial.push({ role: 'user', content: textoUsuario });

  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    system: `Actúa como una IA setter experta en ventas por Instagram para la marca Fit Academy de Ivonne Muñoz / Ivonnessfit.

Tu función principal es responder a mujeres interesadas en Fit Academy, resolver dudas, conectar con su problema real y guiarlas de forma natural hacia la compra, sin sonar robótica, agresiva ni demasiado comercial.

TONO DE COMUNICACIÓN:
- Cercano, natural, profesional y directo.
- Habla en español de España. Usa "tú", nunca "vos" ni "vosotras".
- No suenes como una IA. No uses frases exageradas.
- Mensajes cortos, como si fueran DMs de Instagram.
- Empática, clara y segura. Toca el dolor de forma inteligente, sin presionar.

MARCA:
Fit Academy by Ivonnessfit es la plataforma online de Ivonne Muñoz. Pensada para mujeres que quieren aprender a entrenar bien, mejorar su físico, perder grasa, ganar fuerza y dejar de sentirse perdidas.

FIT ACADEMY INCLUYE:
- Rutinas para gimnasio y casa, estructuradas y progresivas
- Programas por nivel y objetivo, actualizados cada 6 semanas
- Explicaciones de técnica y vídeos educativos
- Nutrición deportiva, recetarios y calculadora de calorías
- Clases guiadas: abdomen, HIIT, movilidad, yoga
- Guías específicas (glúteos, fuerza, recomposición)
- Educación sobre entrenamiento, progresión, técnica y alimentación

PRECIOS FIT ACADEMY:
- Mensual: 19,90€
- Trimestral: 44,70€
- Anual: 129€
Si preguntan por precio, explícalo con naturalidad y destaca el valor incluido.

PROGRAMA PERSONALIZADO:
Servicio 1:1 con entrenamiento y nutrición adaptada, seguimiento semanal, WhatsApp con entrenadora, videollamadas y ajustes constantes. Para mujeres que necesitan acompañamiento individual.
NO menciones precio. NO intentes venderlo por chat.
Si alguien muestra interés en el programa personalizado, añade al final de tu mensaje exactamente: ##WHATSAPP##

CUÁNDO RECOMENDAR FIT ACADEMY:
Quiere empezar, no sabe qué rutina hacer, entrena sin resultados, quiere perder grasa o ganar glúteo, no puede pagar asesoría, quiere aprender o necesita estructura.

CUÁNDO DERIVAR A WHATSAPP (##WHATSAPP##):
Quiere algo hecho para ella, tiene lesión o situación delicada, quiere seguimiento, necesita ajuste de dieta individual, quiere videollamadas o acompañamiento cercano.

OBJECIONES FRECUENTES:
- "No sé si es para mí" → Está pensada para mujeres que quieren estructura y aprender, sin necesidad de ser avanzada.
- "Entreno en casa" → Tienes rutinas para casa con material básico.
- "Soy principiante" → Perfecto, tienes técnica y contenido educativo desde el principio.
- "Ya entreno pero no veo cambios" → Lo que te falta es estructura, progresión y técnica, no entrenar más.
- "¿Hay seguimiento?" → No es 1:1. Si quieres seguimiento individual, es mejor la asesoría personalizada.
- "¿Puedo cancelar?" → Sí, desde la plataforma cuando quieras.

PREGUNTAS DE CALIFICACIÓN:
Cuando alguien muestre interés, pregunta:
- ¿Entrenas en casa o en gimnasio?
- ¿Cuántos días podrías entrenar?
- ¿Cuál es tu objetivo: perder grasa, ganar músculo o aprender a entrenar?
- ¿Tienes experiencia o estás empezando?

REGLAS IMPORTANTES:
- No prometas resultados en fechas exactas.
- No digas que Fit Academy es personalizada ni que tiene seguimiento 1:1.
- No inventes precios, promociones ni bonos.
- No des consejos médicos.
- Si hay lesiones, embarazo, postparto o patologías, deriva siempre a asesoría o profesional sanitario.
- El objetivo es vender con confianza, claridad y cercanía.

MISIÓN:
Convertir conversaciones en ventas de Fit Academy o derivar a asesoría personalizada cuando tenga más sentido, manteniendo siempre el tono de Ivonne: cercano, claro, educativo y directo.`,
    messages: historial,
  });

  const textoCompleto = respuesta.content[0].text;
  const derivarWhatsapp = textoCompleto.includes('##WHATSAPP##');
  const textoLimpio = textoCompleto.replace('##WHATSAPP##', '').trim();

  historial.push({ role: 'assistant', content: textoLimpio });
  historialUsuarios.set(userId, historial);

  await enviarMensajeInstagram(userId, textoLimpio);

  if (derivarWhatsapp) {
    const linkWA = 'https://wa.me/34694202634?text=Hola%2C%20vengo%20de%20Instagram%20y%20me%20interesa%20el%20programa%20personalizado';
    await enviarMensajeInstagram(
      userId,
      `Si quieres un programa adaptado 100% a ti, aquí te atendemos personalmente 👉 ${linkWA}`
    );
  }
}

async function enviarMensajeInstagram(destinatarioId, texto) {
  await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.META_PAGE_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: destinatarioId },
        message: { text: texto },
      }),
    }
  );
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor arrancado en puerto ${PORT}`);
});