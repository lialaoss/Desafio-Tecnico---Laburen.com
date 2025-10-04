import axios from 'axios';
import { askGemini } from './geminiClient.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

export async function procesarMensaje(texto, userState, userPhone) {
  try {
    const intent = await analizarIntencion(texto);
    console.log(`[Usuario ${userPhone}] Intención detectada: ${intent}`);
    
    let respuesta = '';
    
    switch (intent) {
      case 'listar_todos':
        respuesta = await listarTodos(userState);
        break;
      case 'buscar_categoria':
        respuesta = await buscarPorCategoria(texto, userState);
        break;
      case 'buscar_nombre':
        respuesta = await buscarPorNombre(texto, userState);
        break;
      case 'buscar_descripcion':
        respuesta = await buscarPorDescripcion(texto, userState);
        break;
      case 'sugerir':
        respuesta = await sugerirProductos(texto, userState);
        break;
      case 'agregar_carrito':
        respuesta = await agregarAlCarrito(texto, userState);
        break;
      case 'agregar_por_id':
        respuesta = await agregarDesdeTextoConId(texto, userState);
        break;
      case 'eliminar_producto':
        respuesta = await eliminarProductoDelCarrito(texto, userState);
        break;
      case 'editar_cantidad':
        respuesta = await editarCantidadProducto(texto, userState);
        break;
      case 'ver_carrito':
        respuesta = await verCarrito(userState, false);
        break;
      case 'ver_mas':
        respuesta = await mostrarMasProductos(userState);
        break;
      case 'continuar_comprando':
        respuesta = await continuarComprando(userState);
        break;
      case 'finalizar_compra':
        respuesta = await verCarrito(userState, true);
        break;
      default:
        respuesta = 'Mmm... no me quedó claro lo que quisiste decir.\nProbá escribiendo:\n• "ver carrito"\n• "camisetas rojas"\n• "ropa deportiva"\n• "recomiéndame algo"';
    }
    
    return respuesta;
    
  } catch (error) {
    console.error('❌ Error en procesarMensaje:', error);
    return '❌ Ocurrió un error. Por favor intentá de nuevo.';
  }
}

async function analizarIntencion(texto) {
  const lower = texto.toLowerCase();
  
  if (lower.match(/ver mas|mostrar mas|mas productos|siguiente|continuar lista|siguiente pagina/)) {
    return 'ver_mas';
  }

  if (lower.match(/finalizar compra|finalizar|terminar compra|terminar|pagar|checkout|proceder/)) {
    return 'finalizar_compra';
  }

  if (lower.match(/eliminar|quitar|borrar|sacar|remover/)) {
    return 'eliminar_producto';
  }

  if (lower.match(/cambiar cantidad|modificar cantidad|actualizar cantidad|editar cantidad|cambiar.*a \d+ unidades/)) {
    return 'editar_cantidad';
  }
  
  if (lower.match(/agregar (producto |id )?(\d+)|comprar (producto |id )?(\d+)|id (\d+)/)) {
    return 'agregar_por_id';
  }
  
  if (lower.match(/ver (mi )?carrito|mostrar (mi )?carrito|que tengo|mi carrito/)) {
    return 'ver_carrito';
  }
  
  if (lower.match(/todos los productos|todo el catalogo|muestra todo|ver todo|lista completa/)) {
    return 'listar_todos';
  }
  
  if (lower.match(/recomienda|recomendaci|sugiere|sugerencia|que compro|que me conviene|recomiendame/)) {
    return 'sugerir';
  }
  
  if (lower.match(/quiero comprar|agregar al carrito|añadir|comprar|llevar/) &&
      lower.match(/\d+|un|una|dos|tres|cuatro|cinco/)) {
    return 'agregar_carrito';
  }
  
  if (lower.match(/ropa (deportiv|casual|formal|elegant)|deportiv|casual|formal|elegant/) && 
      !lower.match(/comprar|agregar|añadir|llevar/)) {
    return 'buscar_categoria';
  }
  
  if (lower.match(/busco|quiero|necesito|mostrame|muestra|dame|ver|pantalon|camiseta|camisa|falda|sudadera|chaqueta|short|remera|buzo|vestido/)) {
    return 'buscar_nombre';
  }

  if (lower.match(/ideal|aire libre|comod|modern|liger|diseño|diario|alta calidad/)) {
    return 'buscar_descripcion';
  }
  
  return 'otra';
}

async function extraerComponentesBusqueda(texto) {
  const prompt = `Analiza este texto y extrae información de búsqueda:
"${texto}"

Extrae: tipo, color, categoria, talla
Responde SOLO en formato JSON:
{"tipo":"pantalon","color":"rojo","categoria":null,"talla":null}

Importante:
- Plurales a singular: pantalones->pantalon
- Sin acentos: pantalon (no pantalón)
- Si no encuentras algo, usa null`;

  try {
    const respuesta = await askGemini(prompt);
    const jsonMatch = respuesta.match(/\{[\s\S]*?\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.log('⚠️ Error en Gemini extracción');
  }
  
  return { tipo: null, color: null, categoria: null, talla: null };
}

function construirQueryBusqueda(componentes) {
  const partes = [];
  
  if (componentes.tipo) partes.push(componentes.tipo);
  if (componentes.color) partes.push(componentes.color);
  if (componentes.categoria && !componentes.tipo) partes.push(componentes.categoria);
  
  return partes.join(' ');
}

// Función auxiliar para formatear productos para WhatsApp
function formatearProducto(p, index = null) {
  const lineas = [];
  
  if (index !== null) {
    lineas.push(`• ${p.name}`);
  } else {
    lineas.push(`• ${p.name}`);
  }
  
  lineas.push(`   ID: ${p.id} | Precio: $${p.price}`);
  lineas.push(`   Stock: ${p.stock} unidades`);
  
  return lineas.join('\n');
}

async function listarTodos(userState) {
  try {
    console.log(`Llamando a: ${API_BASE}/products`);
    const res = await axios.get(`${API_BASE}/products`);
    
    console.log(`Respuesta recibida:`, res.data);
    
    const productos = res.data.data || [];
    
    if (productos.length === 0) {
      return 'Ups, parece que no hay productos disponibles por ahora.';
    }
    
    userState.lastProducts = productos;
    userState.lastSearchQuery = 'todos';
    userState.displayOffset = 0;
    
    const primeros10 = productos.slice(0, 10);
    
    let mensaje = '¡Este es nuestro catálogo completo!\n\n';
    
    primeros10.forEach((p, i) => {
      mensaje += formatearProducto(p, i + 1) + '\n\n';
    });
    
    mensaje += `Mostrando ${primeros10.length} de ${productos.length} productos\n\n`;
    mensaje += '💡 Escribí "ver más" para seguir viendo productos\n';
    mensaje += '💡 Escribí "agregar ID X" para sumar el producto al carrito';
    
    userState.phase = 'exploring';
    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en listarTodos:', error.message);
    return 'Ups, hubo un problema al cargar los productos. Por favor, intentá de nuevo más tarde.';
  }
}

async function buscarPorCategoria(texto, userState) {
  try {
    const prompt = `Del texto: "${texto}"\nExtrae SOLO la categoría (deportivo, casual, formal, elegante).\nResponde una palabra.`;
    
    const respuesta = await askGemini(prompt);
    const categoria = respuesta.trim().toLowerCase();
    
    console.log(`📡 Buscando categoría: ${categoria}`);
    const res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(categoria)}`);
    const productos = res.data.data || [];
    
    if (productos.length === 0) {
      return `No encontré productos para "${categoria}".\n\nProbá con estas categorías: deportivo, casual, formal o elegante.`;
    }
    
    userState.lastProducts = productos;
    userState.lastSearchQuery = categoria;
    userState.displayOffset = 0;
    
    const primeros10 = productos.slice(0, 10);
    
    let mensaje = `✅ Encontré ${productos.length} productos para "${categoria}"\n\n`;
    
    primeros10.forEach((p, i) => {
      mensaje += formatearProducto(p, i + 1) + '\n\n';
    });
    
    if (productos.length > 10) {
      mensaje += `Mostrando 10 de ${productos.length}\n\n`;
    }
    
    mensaje += 'Para llevar este producto al carrito, escribí "agregar ID X"';
    
    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en buscarPorCategoria:', error);
    return 'Ups, hubo un problema al buscar productos. Intentá de nuevo en un momento.';
  }
}

async function buscarPorNombre(texto, userState) {
  try {
    const componentes = await extraerComponentesBusqueda(texto);
    let query = construirQueryBusqueda(componentes);
    
    if (!query) {
      return 'No entendí qué estás buscando.\n\n💡 Probá con algo como:\n• "pantalones"\n• "camisetas rojas"\n• "pantalones negros"';
    }
    
    console.log(`Buscando: ${query}`);
    let res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(query)}`);
    let productos = res.data.data || [];
    
    // Si no encuentra con color, buscar solo tipo
    if (productos.length === 0 && componentes.color) {
      query = componentes.tipo;
      res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(query)}`);
      productos = res.data.data || [];
      
      if (productos.length > 0 && componentes.color) {
        const colorLower = componentes.color.toLowerCase();
        productos = productos.filter(p => 
          p.name.toLowerCase().includes(colorLower) || 
          (p.color && p.color.toLowerCase().includes(colorLower))
        );
      }
    }
    
    if (productos.length === 0) {
      return 'Mmm, no encontré nada con esa búsqueda.\n💡 Probá escribiendo:\n• "pantalones"\n• "camisetas rojas"';
    }

    userState.lastProducts = productos;
    userState.lastSearchQuery = query;
    userState.displayOffset = 0;
    
    const primeros10 = productos.slice(0, 10);
    
    let mensaje = `✅ Genial, encontré ${productos.length} producto${productos.length > 1 ? 's' : ''}\n\n`;
    
    primeros10.forEach((p, i) => {
      mensaje += formatearProducto(p, i + 1) + '\n\n';
    });
    
    if (productos.length > 10) {
      mensaje += `Mostrando 10 de ${productos.length}\n\n`;
    }
    
    mensaje += '💡 Para llevar este producto al carrito, escribí "agregar ID X"';

    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en buscarPorNombre:', error);
    return 'Ups, hubo un problema al buscar productos. Intentá de nuevo en un momento.';
  }
}

async function buscarPorDescripcion(texto, userState) {
  try {
    const res = await axios.get(`${API_BASE}/products`);
    let productos = res.data.data || [];
    
    const palabrasClave = ['ideal', 'aire libre', 'comoda', 'moderna', 'ligera', 'diseño', 'diario', 'alta calidad'];
    const keywords = palabrasClave.filter(palabra => 
      texto.toLowerCase().includes(palabra.replace('á', 'a').replace('ó', 'o'))
    );
    
    if (keywords.length === 0) {
      return 'Mmm, no entendí tu búsqueda.\n💡 Podés probar con:\n• "ropa cómoda"\n• "prendas para aire libre"';
    }
    
    const productosFiltrados = productos.filter(p => {
      const textoProducto = `${p.name} ${p.description || ''}`.toLowerCase();
      return keywords.some(keyword => textoProducto.includes(keyword.toLowerCase()));
    });
    
    if (productosFiltrados.length === 0) {
      return 'Mmm, no encontré productos con esas características.';
    }
    
    userState.lastProducts = productosFiltrados;
    
    const primeros10 = productosFiltrados.slice(0, 10);
    let mensaje = `✅ ${productosFiltrados.length} productos encontrados\n\n`;
    
    primeros10.forEach((p, i) => {
      mensaje += formatearProducto(p, i + 1) + '\n\n';
    });
    
    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en buscarPorDescripcion:', error);
    return 'Ups, hubo un problema al buscar. Intentá nuevamente en un momento.';
  }
}

async function sugerirProductos(texto, userState) {
  try {
    const res = await axios.get(`${API_BASE}/products`);
    const productos = res.data.data || [];
    const muestra = productos.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    userState.lastProducts = muestra;
    
    let mensaje = '💡 Te paso algunas recomendaciones:\n\n';
    
    muestra.forEach((p, i) => {
      mensaje += formatearProducto(p, i + 1) + '\n\n';
    });
    
    mensaje += '💡 Para llevar este producto al carrito, escribí "agregar ID X"';
    
    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en sugerirProductos:', error);
    return 'Mmm, no pude generar sugerencias ahora. Probá de nuevo en un ratito.';
  }
}

async function verificarStock(productId, cantidad) {
  try {
    const res = await axios.get(`${API_BASE}/products/${productId}`);
    const producto = res.data.data;
    
    return {
      disponible: producto.stock >= cantidad,
      stockActual: producto.stock,
      producto
    };
  } catch (error) {
    return { disponible: false, stockActual: 0, producto: null };
  }
}

async function agregarProductoPorId(productId, cantidad, userState) {
  try {
    const stockInfo = await verificarStock(productId, cantidad);
    
    if (!stockInfo.disponible) {
      return `❌ Stock insuficiente\n\n"${stockInfo.producto?.name || 'Producto'}"\nDisponible: ${stockInfo.stockActual}\nCantidad que querés: ${cantidad}`;
    }
    
    const producto = stockInfo.producto;
    const body = {
      items: [{
        product_id: productId,
        qty: cantidad
      }]
    };
    
    let mensaje = '';
    
    if (!userState.currentCartId) {
      const cartRes = await axios.post(`${API_BASE}/carts`, body);
      const cart = cartRes.data.data;
      
      userState.currentCartId = cart.id;
      userState.phase = 'cart_management';
      
      mensaje = `✅ ¡Carrito creado!\n\n`;
      mensaje += `Agregaste: ${cantidad}x ${producto.name}\n`;
      mensaje += `Total: $${cart.totalPrice.toFixed(2)}\n\n`;
    } else {
      const cartRes = await axios.patch(`${API_BASE}/carts/${userState.currentCartId}`, body);
      const cart = cartRes.data.data;
      
      mensaje = `✅ ¡Agregado al carrito!\n\n`;
      mensaje += `${cantidad}x ${producto.name}\n`;
      mensaje += `Total: $${cart.totalPrice.toFixed(2)}\n\n`;
    }
    
    userState.phase = 'post_add';
    mensaje += '💡 Qué querés hacer ahora:\n';
    mensaje += '• "seguir comprando"\n';
    mensaje += '• "ver carrito"\n';
    mensaje += '• "finalizar compra"';
    
    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en agregarProductoPorId:', error);
    return `Ups, hubo un problema al agregar el producto al carrito. Intentá nuevamente en un momento.`;
  }
}

async function agregarDesdeTextoConId(texto, userState) {
  const idMatch = texto.match(/(?:agregar|comprar|id)\s*(\d+)/i);
  if (!idMatch) {
    return "Mmm, ese ID no funciona. Probá así: 'agregar ID 113'";
  }
  
  const productId = parseInt(idMatch[1]);
  const cantidadMatch = texto.match(/(\d+)\s*(?:unidades|unidad|x)/i);
  const cantidad = cantidadMatch ? parseInt(cantidadMatch[1]) : 1;
  
  return await agregarProductoPorId(productId, cantidad, userState);
}

async function agregarAlCarrito(texto, userState) {
  try {
    const componentes = await extraerComponentesBusqueda(texto);
    const query = construirQueryBusqueda(componentes);
    
    if (!query) {
      return 'Mmm, faltó decir qué producto querés.\n💡 Ejemplo: "comprar 2 camisetas rojas"';
    }
    
    const res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(query)}`);
    let productos = res.data.data || [];
    
    if (productos.length === 0) {
      return `Mmm, no encontré "${query}".\n💡 Probá escribiendo algo diferente o más general.`;
    }
    
    if (productos.length > 1) {
      userState.lastProducts = productos;
      
      let mensaje = `Encontré *${productos.length}* opciones:\n\n`;
      productos.slice(0, 5).forEach((p, i) => {
        mensaje += `${i + 1}. ${p.name} (ID ${p.id}) - $${p.price}\n`;
      });
      mensaje += '\n💡 Para llevar este producto al carrito, escribí "agregar ID X"';
      
      return mensaje;
    }
    
    return await agregarProductoPorId(productos[0].id, 1, userState);
    
  } catch (error) {
    console.error('❌ Error en agregarAlCarrito:', error);
    return 'Ups, hubo un problema al agregar el producto. Intentá de nuevo en un momento.';
  }
}

async function verCarrito(userState, esFinal = false) {
  if (!userState.currentCartId) {
    return '🛒 Tu carrito aún no tiene productos. ¡Agregá algo para empezar!';
  }
  
  try {
    const res = await axios.get(`${API_BASE}/carts/${userState.currentCartId}`);
    const cart = res.data.data;

    if (!cart.items || cart.items.length === 0) {
      return '🛒 Tu carrito aún no tiene productos. ¡Agregá algo para empezar!';
    }
    
    let mensaje = '🛒 Mirá tu carrito:\n\n';
    
    cart.items.forEach(item => {
      const subtotal = (item.product.price * item.qty).toFixed(2);
      mensaje += `${item.qty}x ${item.product.name}\n`;
      mensaje += `$${item.product.price} c/u = $${subtotal}\n\n`;
    });

    mensaje += `💰 Total: $${cart.totalPrice.toFixed(2)}\n\n`;
    
    if (esFinal) {
      mensaje += '✅ ¡Genial! Tu pedido se registró correctamente. Gracias por comprar con nosotros.';
      userState.currentCartId = null;
      userState.phase = 'welcome';
    } else {
      mensaje += '💡 Cuando estés listo, escribí "finalizar compra".';
    }
    
    return mensaje;
    
  } catch (error) {
    console.error('❌ Error en verCarrito:', error);
    return 'Ups, hubo un problema al consultar tu carrito. Intentá de nuevo en un momento.';
  }
}

async function eliminarProductoDelCarrito(texto, userState) {
  if (!userState.currentCartId) {
    return '🛒 Tu carrito aún no tiene productos. ¡Agregá algo para empezar!';
  }

  try {
    const cartRes = await axios.get(`${API_BASE}/carts/${userState.currentCartId}`);
    const cart = cartRes.data.data;

    if (!cart.items || cart.items.length === 0) {
      return '🛒 Tu carrito aún no tiene productos. ¡Agregá algo para empezar!';
    }

    const idMatch = texto.match(/(?:id\s*)?(\d+)/i);
    if (!idMatch) {
      let mensaje = '🛒 Productos en tu carrito:\n\n';
      cart.items.forEach(item => {
        mensaje += `ID: ${item.product.id} | ${item.qty}x ${item.product.name}\n`;
      });
      mensaje += '\n💡 Si querés sacar un producto del carrito, escribí: "eliminar ID X"';
      return mensaje;
    }

    const productIdToRemove = parseInt(idMatch[1]);
    const itemToRemove = cart.items.find(item => item.product.id === productIdToRemove);
    
    if (!itemToRemove) {
      return `Mmm, no encontré el producto con ID ${productIdToRemove} en tu carrito.`;
    }
    
    const remainingItems = cart.items
      .filter(item => item.product.id !== productIdToRemove)
      .map(item => ({
        product_id: item.product.id,
        qty: item.qty
      }));
      
    if (remainingItems.length === 0) {
      userState.currentCartId = null;
      userState.phase = 'welcome';
      return `✅ Listo, eliminaste ${itemToRemove.qty}x ${itemToRemove.product.name}.\n\nTu carrito quedó vacío.`;
    }
    
    const updateRes = await axios.patch(
      `${API_BASE}/carts/${userState.currentCartId}`,
      { items: remainingItems }
    );

    const updatedCart = updateRes.data.data;

    let mensaje = `✅ Eliminado: ${itemToRemove.qty}x ${itemToRemove.product.name}\n`;
    mensaje += `💰 Total actualizado: $${updatedCart.totalPrice.toFixed(2)}`;

    return mensaje;

  } catch (error) {
    console.error('❌ Error en eliminarProducto:', error);
    return `Ups, hubo un problema al eliminar el producto. Intentá de nuevo en un momento.`;
  }
}

async function editarCantidadProducto(texto, userState) {
  if (!userState.currentCartId) {
    return '🛒 Tu carrito aún no tiene productos. ¡Agregá algo para empezar!';
  }

  try {
    const cartRes = await axios.get(`${API_BASE}/carts/${userState.currentCartId}`);
    const cart = cartRes.data.data;

    if (!cart.items || cart.items.length === 0) {
      return '🛒 Tu carrito aún no tiene productos. ¡Agregá algo para empezar!';
    }

    const idMatch = texto.match(/(?:id|producto)\s*(\d+)/i);
    const cantidadMatch = texto.match(/(?:a|cambiar.*?a)\s+(\d+)\s*(?:unidades?|x)?/i);
    
    if (!idMatch) {
      let mensaje = '🛒 Productos en tu carrito:\n\n';
      cart.items.forEach(item => {
        mensaje += `ID: ${item.product.id} | ${item.qty}x | ${item.product.name}\n`;
      });
      mensaje += '\n💡 Por ejemplo, escribí: "cambiar ID 154 a 3"';
      return mensaje;
    }

    if (!cantidadMatch) {
      return 'Mmm, faltó decir cuántas unidades. Ejemplo: "cambiar ID 154 a 3"';
    }

    const productId = parseInt(idMatch[1]);
    const nuevaCantidad = parseInt(cantidadMatch[1]);

    if (nuevaCantidad <= 0) {
      return 'Mmm, la cantidad tiene que ser mayor a 0. Para sacar un producto del carrito, escribí: "eliminar ID X"';
    }

    const itemToEdit = cart.items.find(item => item.product.id === productId);
    
    if (!itemToEdit) {
      return `Mmm, no encontré el producto con ID ${productId} en tu carrito.`;
    }

    const stockInfo = await verificarStock(productId, nuevaCantidad);
    
    if (!stockInfo.disponible) {
      return `Ups, no hay suficiente stock de "${itemToEdit.product.name}".\nDisponible: ${stockInfo.stockActual}\nCantidad pedida: ${nuevaCantidad}\nActualmente en tu carrito: ${itemToEdit.qty}`;
    }

    const updatedItems = cart.items.map(item => ({
      product_id: item.product.id,
      qty: item.product.id === productId ? nuevaCantidad : item.qty
    }));

    const updateRes = await axios.patch(
      `${API_BASE}/carts/${userState.currentCartId}`,
      { items: updatedItems }
    );

    const updatedCart = updateRes.data.data;

    let mensaje = `✅ Cantidad actualizada\n\n`;
    mensaje += `"${itemToEdit.product.name}"\n`;
    mensaje += `De: ${itemToEdit.qty}x → A: ${nuevaCantidad}x\n`;
    mensaje += `💰 Nuevo total: $${updatedCart.totalPrice.toFixed(2)}`;

    return mensaje;

  } catch (error) {
    console.error('❌ Error en editarCantidad:', error);
    return `❌ Error al editar.`;
  }
}

async function mostrarMasProductos(userState) {
  if (!userState.lastProducts || userState.lastProducts.length === 0) {
    return 'Ups, hubo un problema al editar el producto. Intentá de nuevo en un momento.';
  }
  
  const displayLimit = userState.displayLimit || 10;
  userState.displayOffset = (userState.displayOffset || 0) + displayLimit;
  
  if (userState.displayOffset >= userState.lastProducts.length) {
    userState.displayOffset = userState.lastProducts.length - displayLimit;
    return '✅ Eso es todo, ya te mostré todos los productos.';
  }
  
  const productos = userState.lastProducts.slice(
    userState.displayOffset,
    userState.displayOffset + displayLimit
  );
  
  let mensaje = `Productos ${userState.displayOffset + 1} a ${userState.displayOffset + productos.length} de ${userState.lastProducts.length}\n\n`;
  
  productos.forEach((p, i) => {
    mensaje += formatearProducto(p, userState.displayOffset + i + 1) + '\n\n';
  });
  
  if (userState.displayOffset + displayLimit < userState.lastProducts.length) {
    mensaje += '💡 Para continuar mirando, escribí "ver más"';
  }
  
  return mensaje;
}

async function continuarComprando(userState) {
  userState.phase = 'exploring';
  return '¡Perfecto! ¿Qué más querés buscar?\n\nPodés hacerlo por nombre, categoría o pedirme recomendaciones.';
}