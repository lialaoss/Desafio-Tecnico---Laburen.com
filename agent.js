import axios from 'axios';
import { askGemini } from './geminiClient.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';


export async function procesarMensaje(texto, userState, userPhone) {
  try {
    const intent = await analizarIntencion(texto);
    console.log(`[Debug: Usuario ${userPhone} | Intención = ${intent}]`);
    
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
        respuesta = '🤔 No entendí tu mensaje.\n\nPodés probar con:\n• "ver carrito"\n• "camisetas rojas"\n• "ropa deportiva"\n• "recomiéndame algo"';
    }
    
    return respuesta;
    
  } catch (error) {
    console.error('Error en procesarMensaje:', error);
    return '❌ Ocurrió un error. Por favor intentá de nuevo en un momento.';
  }
}


async function analizarIntencion(texto) {
  const lower = texto.toLowerCase();
  
  if (lower.match(/ver mas|mostrar mas|mas productos|siguiente|continuar|siguiente pagina/)) {
    return 'ver_mas';
  }

  if (lower.match(/finalizar compra|finalizar|terminar compra|terminar|pagar|checkout|proceder/)) {
    return 'finalizar_compra';
  }

  if (lower.match(/eliminar|quitar|borrar|sacar|remover/)) {
    return 'eliminar_producto';
  }

  if (lower.match(/cambiar cantidad|modificar cantidad|actualizar cantidad|editar cantidad|quiero \d+.*del id|cambiar.*a \d+ unidades/)) {
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
  
  if (lower.match(/prendas? (de )?color|ropa (de )?color|tenes.*(rojo|azul|verde|negro|blanco|amarillo|gris)/)) {
    return 'buscar_nombre';
  }
  
  if (lower.match(/recomienda|recomendaci|sugiere|sugerencia|que compro|que me conviene|buscame|perfecta? para|recomiendame|comoda|comodo/)) {
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

  if (lower.match(/ideal|aire libre|comod|modern|liger|diseño|diario|uso|usar|material|alta|calidad|buen|actividad/)) {
    return 'buscar_descripcion';
  }
  return 'otra';
}


async function extraerComponentesBusqueda(texto) {
  const prompt = `
Analiza este texto y extrae información de búsqueda de productos de ropa:
"${texto}"

Los productos tienen estos campos:
- tipo: pantalon, camiseta, camisa, falda, sudadera, chaqueta, vestido, short, remera, buzo, campera (SIEMPRE EN SINGULAR, sin acento)
- color: rojo, azul, verde, negro, blanco, gris, rosa, morado, naranja, amarillo, marron, beige, celeste
- categoria: deportivo, casual, formal, elegante, sport
- talla: s, m, l, xl, xxl
- description: ideal, diseño, alta calidad, material, moderno, elegante, aire, libre, comoda, ligera, perfecta, diario

Extrae lo que encuentres y responde SOLO en este formato JSON:
{
  "tipo": "palabra_singular_o_null",
  "color": "color_o_null",
  "categoria": "categoria_o_null",
  "talla": "talla_o_null",
  "description": "description_o_null"
}

Ejemplos:
"pantalones rojos" -> {"tipo":"pantalon","color":"rojo","categoria":null,"talla":null}
"camisetas deportivas talla M" -> {"tipo":"camiseta","color":null,"categoria":"deportivo","talla":"m"}
"faldas negras" -> {"tipo":"falda","color":"negro","categoria":null,"talla":null}
"busco shorts" -> {"tipo":"short","color":null,"categoria":null,"talla":null}
"pantalon" -> {"tipo":"pantalon","color":null,"categoria":null,"talla":null}

IMPORTANTE: 
- Convierte SIEMPRE plurales a singular (pantalones->pantalon, camisas->camisa)
- Tipo siempre sin acento: pantalon (no pantalón)
- Si no encuentras algo, usa null
`;

  try {
    const respuesta = await askGemini(prompt);
    const jsonMatch = respuesta.match(/\{[\s\S]*?\}/);
    
    if (jsonMatch) {
      const componentes = JSON.parse(jsonMatch[0]);
      return componentes;
    }
  } catch (error) {
    console.log('[Debug: Error en Gemini extracción]');
  }
  
  return { tipo: null, color: null, categoria: null, talla: null };
}


function construirQueryBusqueda(componentes) {
  const partes = [];
  
  if (componentes.tipo) {
    partes.push(componentes.tipo);
  }
  
  if (componentes.color) {
    partes.push(componentes.color);
  }
  
  if (componentes.categoria && !componentes.tipo) {
    partes.push(componentes.categoria);
  }
  
  return partes.join(' ');
}


async function listarTodos(userState) {
  try {
    const res = await axios.get(`${API_BASE}/products`);
    const productos = res.data.data;
    
    userState.lastProducts = productos;
    userState.lastSearchQuery = 'todos';
    userState.displayOffset = 0;
    
    let mensaje = '📦 *Catálogo completo:*\n\n';
    
    productos.slice(0, 10).forEach(p => {
      mensaje += `• ${p.name}\n`;
      mensaje += `  ID: ${p.id} | $${p.price} | Stock: ${p.stock}\n\n`;
    });
    
    mensaje += `(Mostrando 10 de ${productos.length} productos)\n\n`;
    mensaje += '💡 Escribí "ver más" para mostrar más productos';
    
    userState.phase = 'exploring';
    return mensaje;
    
  } catch (error) {
    return '❌ Hubo un problema al cargar los productos. Intentá de nuevo más tarde.';
  }
}

async function buscarPorCategoria(texto, userState) {
  try {
    const prompt = `Del texto: "${texto}"\nExtrae SOLO la categoría.\nCategorías: deportivo, casual, formal, elegante, sport\nResponde solo una palabra.`;
    
    const respuesta = await askGemini(prompt);
    const categoria = respuesta.trim().toLowerCase();
    
    const res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(categoria)}`);
    const productos = res.data.data;
    
    if (productos.length === 0) {
      return '❌ No encontré productos en esa categoría.\n\nCategorías disponibles: deportivo, casual, formal, elegante';
    }
    
    userState.lastProducts = productos;
    userState.lastSearchQuery = categoria;
    
    let mensaje = `✅ Encontré ${productos.length} producto${productos.length > 1 ? 's' : ''} en "${categoria}":\n\n`;
    productos.slice(0, 10).forEach(p => {
      mensaje += `• ${p.name}\n  ID: ${p.id} | Precio: $${p.price} | Stock: ${p.stock}\n\n`;
    });
    
    if (productos.length > 10) {
      mensaje += `(Mostrando 10 de ${productos.length} productos)\n`;
    }
    mensaje += '💡 Podés agregar productos a tu carrito usando el ID.';
    return mensaje;
    
  } catch (error) {
    console.log('❌ Lo siento, hubo un problema al buscar productos. Intenta de nuevo más tarde.');
  }
}


async function buscarPorNombre(texto, userState) {
  try {
    
    const componentes = await extraerComponentesBusqueda(texto);
    let query = construirQueryBusqueda(componentes);
    
    if (!query) {
      return '❌ No entendí qué estás buscando.\n\n💡 Ejemplos:\n• "pantalones"\n• "camisetas rojas"\n• "pantalones negros talla M"';
    }
    
    let res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(query)}`);
    let productos = res.data.data;
    
    if (productos.length === 0 && componentes.color) {
      query = componentes.tipo;
      res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(query)}`);
      productos = res.data.data;
      
      if (productos.length > 0 && componentes.color) {
        const colorLower = componentes.color.toLowerCase();
        productos = productos.filter(p => 
          p.name.toLowerCase().includes(colorLower) || 
          (p.color && p.color.toLowerCase().includes(colorLower))
        );
      }
    }
    
    if (componentes.talla && productos.length > 0) {
      const tallaBuscada = componentes.talla.toUpperCase();
      const productosFiltrados = productos.filter(p => 
        p.name.toUpperCase().includes(`TALLA ${tallaBuscada}`)
      );
      
      if (productosFiltrados.length > 0) {
        productos = productosFiltrados;
      }
    }
    
    if (productos.length === 0) {
      return '❌ No encontré productos con esa búsqueda.\n\n💡 Probá con:\n• Solo tipo: "pantalones", "camisetas"\n• Con color: "camisetas rojas"';
    }

    userState.lastProducts = productos;
    userState.lastSearchQuery = query;
    userState.displayOffset = 0;
    
    let mensaje = `✅ Encontré ${productos.length} producto${productos.length > 1 ? 's' : ''}:\n\n`;
    
    productos.slice(0, 10).forEach((p, index) => {
      mensaje += `• ${p.name}\n`;
      mensaje += `ID: ${p.id} | Precio: $${p.price} | Stock: ${p.stock}\n\n`;
    });
    
    if (productos.length > 10) {
      mensaje += `(Mostrando 10 de ${productos.length} productos)\n\n`;
      userState.displayOffset = 0;
    }
    
    if (productos.length > 1) {
      mensaje += '💡 Para agregar uno a tu carrito podés decir: "comprar el 1" o "agregar ID 113".';
      userState.waitingForSelection = true;
    } else {
      mensaje += '💡 Para agregarlo a tu carrito escribí: "agregar al carrito".';
    }

    return mensaje;
    
  } catch (error) {
    return '❌ Hubo un problema al buscar: ' + error.message;
  }
}


async function buscarPorDescripcion(texto, userState) {
  try {
    const res = await axios.get(`${API_BASE}/products`);
    let productos = res.data.data;
    
    const palabrasClave = ['ideal', 'aire libre', 'comoda', 'moderna', 'ligera', 'diseño', 'diario', 'alta calidad'];
    const keywords = palabrasClave.filter(palabra => 
      texto.toLowerCase().includes(palabra.replace('á', 'a').replace('ó', 'o'))
    );
    
    if (keywords.length === 0) {
      return '❌ No entendí qué características buscás.\n\n💡 Ejemplos:\n• "ropa cómoda para el diario"\n• "prendas para aire libre"';
    }
    
    const productosFiltrados = productos.filter(p => {
      const textoProducto = `${p.name} ${p.description || ''}`.toLowerCase();
      return keywords.some(keyword => textoProducto.includes(keyword.toLowerCase()));
    });
    
    if (productosFiltrados.length === 0) {
      return '❌ No encontré productos con esas características.\n\n💡 Probá buscar por tipo o categoría.';
    }
    
    userState.lastProducts = productosFiltrados;
    
    let mensaje = `✅ *${productosFiltrados.length}* producto${productosFiltrados.length > 1 ? 's' : ''} encontrados:\n\n`;
    
    productosFiltrados.slice(0, 10).forEach(p => {
      mensaje += `• ${p.name}\n  ID: ${p.id} | $${p.price}\n\n`;
    });
    
    return mensaje;
    
  } catch (error) {
    return '❌ Error al buscar por descripción.';
  }
}

async function sugerirProductos(texto, userState) {
  try {
    const res = await axios.get(`${API_BASE}/products`);
    const productos = res.data.data;
    const muestra = productos.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    userState.lastProducts = muestra;
    
    let mensaje = '💡 *Te recomiendo estos productos:*\n\n';
    
    muestra.forEach((p, index) => {
      mensaje += `${index + 1}. ${p.name}\n`;
      mensaje += `   ID: ${p.id} | $${p.price}\n\n`;
    });
    
    return mensaje;
    
  } catch (error) {
    return '❌ Hubo un problema al sugerir productos.';
  }
}


async function extraerCantidad(texto) {
  const prompt = `
Del texto: "${texto}"
Extrae SOLO la cantidad.
"un/una/uno" = 1, "dos" = 2, etc.
Si no hay cantidad = 1
Responde SOLO el número.
`;

  try {
    const respuesta = await askGemini(prompt);
    const numero = parseInt(respuesta.trim());
    return isNaN(numero) ? 1 : numero;
  } catch (error) {
    const numeroMatch = texto.match(/(\d+)/);
    if (numeroMatch) return parseInt(numeroMatch[1]);
    
    const palabras = { 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5 };
    for (const [palabra, num] of Object.entries(palabras)) {
      if (texto.toLowerCase().includes(palabra)) return num;
    }
    return 1;
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
      return `❌ Lo siento, "${stockInfo.producto?.name || 'ese producto'}" no tiene stock suficiente.\n\nStock disponible: ${stockInfo.stockActual}\nCantidad solicitada: ${cantidad}`;
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
      
      mensaje = `✅ Carrito creado (ID: ${cart.id})\n\n`;
      mensaje += `Agregué ${cantidad}x ${producto.name}\n`;
      mensaje += `Total: $${cart.totalPrice.toFixed(2)}\n\n`;
    } else {
      const cartRes = await axios.patch(`${API_BASE}/carts/${userState.currentCartId}`, body);
      const cart = cartRes.data.data;
      
      mensaje = `✅ Agregué ${cantidad}x ${producto.name}\n\n`;
      mensaje += `Total actualizado: $${cart.totalPrice.toFixed(2)}\n\n`;
    }
    
    userState.phase = 'post_add';
    mensaje += '💡 Opciones:\n';
    mensaje += '• "seguir comprando"\n';
    mensaje += '• "cambiar cantidad del ID X a Y"\n';
    mensaje += '• "ver carrito" o "finalizar compra"';
    
    return mensaje;
    
  } catch (error) {
    return `❌ Error al agregar el producto: ${error.response?.data?.message || error.message}`;
  }
}


async function agregarDesdeTextoConId(texto, userState) {
  const idMatch = texto.match(/(?:agregar|comprar|id)\s*(\d+)/i);
  if (!idMatch) {
    return "❌ No encontré un ID válido. Probá con: 'agregar ID 113'";
  }
  
  const productId = parseInt(idMatch[1]);
  const cantidadMatch = texto.match(/(\d+)\s*(?:unidades|unidad|x)/i);
  const cantidad = cantidadMatch ? parseInt(cantidadMatch[1]) : 1;
  
  return await agregarProductoPorId(productId, cantidad, userState);
}


async function agregarAlCarrito(texto, userState) {
  try {
    const cantidad = 1;
    const componentes = await extraerComponentesBusqueda(texto);
    const query = construirQueryBusqueda(componentes);
    
    if (!query) {
      return '❌ Necesito que me indiques qué producto querés.\n\nEjemplo: "comprar 2 camisetas rojas"';
    }
    
    const res = await axios.get(`${API_BASE}/products?q=${encodeURIComponent(query)}`);
    let productos = res.data.data;
    
    if (productos.length === 0) {
      return `❌ No encontré productos para "${query}".\n\nProbá buscando primero en el catálogo.`;
    }
    
    if (productos.length > 1) {
      let mensaje = `Encontré *${productos.length}* opciones:\n\n`;
      productos.slice(0, 5).forEach((p, i) => {
        mensaje += `${i + 1}. ${p.name} (ID ${p.id}) - $${p.price}\n`;
      });
      mensaje += '\n💡 Escribí "agregar ID X" para elegir uno.';
      
      userState.lastProducts = productos;
      return mensaje;
    }
    
    return await agregarProductoPorId(productos[0].id, cantidad, userState);
    
  } catch (error) {
    return '❌ Error al buscar el producto: ' + error.message;
  }
}


async function verCarrito(userState, esFinal = false) {
  if (!userState.currentCartId) {
    return '🛒 Tu carrito está vacío.';
  }
  
  try {
    const res = await axios.get(`${API_BASE}/carts/${userState.currentCartId}`);
    const cart = res.data.data;

    if (!cart.items || cart.items.length === 0) {
      return '🛒 Tu carrito está vacío.';
    }
    
    let mensaje = '\n🛒 *Tu carrito:*\n\n';
    
    cart.items.forEach(item => {
      const subtotal = (item.product.price * item.qty).toFixed(2);
      mensaje += `• ${item.qty}x ${item.product.name}\n`;
      mensaje += `  $${item.product.price} c/u → $${subtotal}\n\n`;
    });

    mensaje += `*Total: $${cart.totalPrice.toFixed(2)}*\n\n`;
    
    if (esFinal) {
      mensaje += '✅ ¡Gracias por tu compra!\nTu pedido ha sido registrado.';
      userState.currentCartId = null;
      userState.phase = 'welcome';
    } else {
      mensaje += '💡 Escribí "finalizar compra" cuando estés listo.';
    }
    
    return mensaje;
    
  } catch (error) {
    return '❌ Error al consultar el carrito: ' + error.message;
  }
}


async function eliminarProductoDelCarrito(texto, userState) {
  if (!userState.currentCartId) {
    return '🛒 Tu carrito está vacío. No hay nada para eliminar.';
  }

  let mensaje = '';

  try {
    const cartRes = await axios.get(`${API_BASE}/carts/${userState.currentCartId}`);
    const cart = cartRes.data.data;

    if (!cart.items || cart.items.length === 0) {
      return '🛒 Tu carrito está vacío.';
    }

    const idMatch = texto.match(/(?:id\s*)?(\d+)/i);
    if (!idMatch) {
      let mensaje = '*Productos en tu carrito:*\n\n';
      cart.items.forEach(item => {
        mensaje += `• ID: ${item.product.id} | ${item.qty}x ${item.product.name}\n`;
      });
      mensaje += '\n¿Qué producto querés eliminar?\nEscribí: "eliminar ID [número]"';
      return mensaje;
    }

    const productIdToRemove = parseInt(idMatch[1]);
    const itemToRemove = cart.items.find(item => item.product.id === productIdToRemove);
    
    if (!itemToRemove) {
      return `\n❌ El producto con ID ${productIdToRemove} no está en tu carrito.`;
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
      return `\n✅ Eliminé ${itemToRemove.qty}x ${itemToRemove.product.name} de tu carrito.\n\nTu carrito ahora está *vacío*.\n\n💡 ¿Qué estás buscando ahora?`;
    }
    const updateRes = await axios.patch(
      `${API_BASE}/carts/${userState.currentCartId}`,
      { items: remainingItems }
    );

    const updatedCart = updateRes.data.data;

    mensaje += `\n✅ Eliminé ${itemToRemove.qty}x ${itemToRemove.product.name} de tu carrito.`;
    mensaje += `\nNuevo total: $${updatedCart.totalPrice.toFixed(2)}`; 
    mensaje += '\n\n💡 ¿Querés seguir comprando o finalizar tu compra?';

  } catch (error) {
    return `❌ Error al eliminar el producto: ${error.response?.data?.message || error.message}`;
  }
}


async function editarCantidadProducto(texto, userState) {
  if (!userState.currentCartId) {
    return 'Tu carrito está vacío. Primero agregá productos.';
  }

  let mensaje = '';

  try {
    const cartRes = await axios.get(`${API_BASE}/carts/${userState.currentCartId}`);
    const cart = cartRes.data.data;

    if (!cart.items || cart.items.length === 0) {
      return '🛒 Tu carrito está vacío.';
    }

    const idMatch = texto.match(/(?:id|producto)\s*(\d+)/i);
    const cantidadMatch = texto.match(/(?:a|cambiar.*?a|modificar.*?a)\s+(\d+)\s*(?:unidades?|x)?/i);
    
    if (!idMatch) {
      mensaje += '\nProductos en tu carrito:\n\n';
      cart.items.forEach(item => {
        mensaje += `• ID: ${item.product.id} | Cantidad actual: ${item.qty}x | ${item.product.name}\n`;
      });
      mensaje += '\n💡 ¿Qué producto querés modificar? Ejemplo: "cambiar cantidad del ID 154 a 3 unidades"';
      return mensaje;
    }

    if (!cantidadMatch) {
      return '❌ ¿A cuántas unidades querés cambiar? Ejemplo: "cambiar ID 154 a 3 unidades"';
    }

    const productId = parseInt(idMatch[1]);
    const nuevaCantidad = parseInt(cantidadMatch[1]);

    if (nuevaCantidad <= 0) {
      return '❌ La cantidad debe ser mayor a 0. Si querés eliminar el producto, usá: "eliminar ID [número]"';
    }

    const itemToEdit = cart.items.find(item => item.product.id === productId);
    
    if (!itemToEdit) {
      return `\n❌ El producto con ID ${productId} no está en tu carrito.`;
    }

    const stockInfo = await verificarStock(productId, nuevaCantidad);
    
    if (!stockInfo.disponible) {
      mensaje += `\n❌ Lo siento, "${itemToEdit.product.name}" no tiene suficiente stock.`;
      mensaje += `\nStock disponible: ${stockInfo.stockActual} unidades`;
      mensaje += `\nCantidad solicitada: ${nuevaCantidad} unidades`;
      mensaje += `\nCantidad actual en tu carrito: ${itemToEdit.qty} unidades`;
      return mensaje;
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
    const cantidadAnterior = itemToEdit.qty;

    mensaje += `\n✅ Cantidad actualizada para "${itemToEdit.product.name}"`;
    mensaje += `\nAntes: ${cantidadAnterior}x | Ahora: ${nuevaCantidad}x`;
    mensaje += `\nNuevo total del carrito: $${updatedCart.totalPrice.toFixed(2)}`;
    mensaje += '\n\n💡 Podés seguir comprando, modificar otras cantidades o finalizar tu compra.';

  } catch (error) {
    return `❌ Error al editar la cantidad: ${error.response?.data?.message || error.message}`;
  }
}

async function mostrarMasProductos(userState) {
  if (!userState.lastProducts || userState.lastProducts.length === 0) {
    return '❌ No hay búsqueda activa para mostrar más resultados. Probá buscando algo primero.';
  }
  
  const displayLimit = userState.displayLimit || 10;
  userState.displayOffset = (userState.displayOffset || 0) + displayLimit;
  
  if (userState.displayOffset >= userState.lastProducts.length) {
    userState.displayOffset = userState.lastProducts.length - displayLimit;
    return '✅ Ya mostramos todos los productos de esta búsqueda.';
  }
  
  const productos = userState.lastProducts.slice(
    userState.displayOffset,
    userState.displayOffset + displayLimit
  );
  
  let mensaje = `\n✅ Mostrando productos ${userState.displayOffset + 1} a ${userState.displayOffset + productos.length} de ${userState.lastProducts.length}:\n\n`;
  
  productos.forEach((p, index) => {
    mensaje += `• ${p.name}\n`;
    mensaje += ` ID: ${p.id} | $${p.price} | Stock: ${p.stock}\n\n`;
  });
  
  if (userState.displayOffset + displayLimit < userState.lastProducts.length) {
    mensaje += '💡 Escribí "ver más" para mostrar más productos.';
  }
  return mensaje;
}

async function continuarComprando(userState) {
  userState.phase = 'exploring';
  return '\n¡Perfecto! ¿Qué más estás buscando?\n\nPodés buscar por nombre, categoría, o pedirme recomendaciones.';
}