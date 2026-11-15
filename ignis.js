// Datos del Suzuki Ignis 2020 GLX CVT (mercado mexicano).
// `ref: true` = dato de referencia tomado de catálogos de refacciones o manuales de otros
// mercados; confirmar con el manual del propietario, la placa de la puerta o la agencia.

export const VEHICLE = {
  name: 'Mi Ignis',
  make: 'Suzuki',
  model: 'Ignis GLX CVT',
  year: 2020,
  pressureFront: 36,
  pressureRear: 32,
};

export const SPECS = [
  ['Motor', [
    ['Tipo', '1.2 L (1,197 cm³), 4 cilindros en línea, gasolina'],
    ['Código de motor', 'K12M', true],
    ['Potencia', '82 hp a 6,000 rpm'],
    ['Torque', '113 Nm (83 lb-pie) a 4,200 rpm'],
    ['Combustible', 'Gasolina; tanque de 32 L'],
    ['Rendimiento combinado', '20.9 km/L (dato de Suzuki México)'],
    ['Autonomía teórica', '≈ 670 km por tanque (32 L × 20.9 km/L)'],
  ]],
  ['Transmisión y chasis', [
    ['Transmisión', 'Automática CVT (variación continua)'],
    ['Fabricante de la CVT', 'Jatco (CVT7)', true],
    ['Tracción', 'Delantera'],
    ['Suspensión delantera', 'McPherson'],
    ['Suspensión trasera', 'Barra de torsión con resortes helicoidales'],
    ['Frenos', 'Discos ventilados adelante, tambor atrás; ABS con EBD'],
    ['Seguridad', '2 bolsas de aire frontales'],
  ]],
  ['Llantas', [
    ['Medida', '175/60 R16'],
    ['Rines', 'Aluminio de 16 pulgadas'],
    ['Presión en frío', '36 psi adelante · 32 psi atrás', true],
  ]],
  ['Dimensiones y peso', [
    ['Largo × ancho × alto', '3,700 × 1,690 × 1,595 mm'],
    ['Distancia entre ejes', '2,435 mm'],
    ['Peso vehicular', '895 kg'],
    ['Cajuela', '271 L (505 L con asientos abatidos)'],
  ]],
];

export const FLUIDS = [
  ['Aceite de motor', 'SAE 0W-20, API SM o superior · 3.1 L con filtro', true],
  ['Aceite de la CVT', 'Suzuki CVTF Green-2 · ≈ 5.8 L en total (un drenado sólo cambia una parte). Sin varilla: se cambia en taller.', true],
  ['Anticongelante', 'Suzuki LLC Super (azul) · ≈ 4.0 L', true],
  ['Bujías', 'Iridio NGK ILZKR6F11 (Suzuki 09482-00647) · calibración 1.0–1.1 mm', true],
  ['Batería', '12 V · 45 Ah · 390 A de arranque', true],
  ['Plumas limpiaparabrisas', 'Conductor ≈ 21" (530 mm) · pasajero ≈ 19" (475 mm) · trasera ≈ 12" (300 mm). Las fuentes varían: mide las tuyas antes de comprar.', true],
];

// [nombre, cada km, cada meses, nota]
export const CONSUMABLES = [
  ['Aceite de motor', 10000, 6, '0W-20 API SM o superior, 3.1 L con filtro. Servicio de agencia cada 10,000 km o 6 meses.'],
  ['Filtro de aceite', 10000, 6, 'Se cambia junto con el aceite.'],
  ['Filtro de aire', 40000, 24, 'Revisar en cada servicio; cambiar antes si hay mucho polvo.'],
  ['Filtro de cabina', 15000, 12, ''],
  ['Aceite de la CVT', 40000, null, 'Suzuki CVTF Green-2. Sólo en taller; las fuentes recomiendan entre 40,000 y 60,000 km.'],
  ['Bujías', 105000, 84, 'Iridio NGK ILZKR6F11, calibración 1.0–1.1 mm.'],
  ['Líquido de frenos', null, 24, 'Usar el tipo indicado en la tapa del depósito.'],
  ['Anticongelante / refrigerante', 75000, 48, 'Suzuki LLC Super (azul), ≈ 4.0 L.'],
  ['Balatas / pastillas de freno', 40000, null, 'Estimado: depende del desgaste. Revisar en cada servicio.'],
  ['Batería', null, 48, '12 V, 45 Ah, 390 A.'],
  ['Llantas', 60000, 60, '175/60 R16. Cambiar antes si el dibujo llega a 1.6 mm.'],
  ['Rotación de llantas', 10000, null, ''],
  ['Plumas limpiaparabrisas', null, 12, 'Conductor ≈ 21", pasajero ≈ 19", trasera ≈ 12".'],
];

export const SERVICE_TYPES = [
  'Servicio de agencia (10,000 km / 6 meses)', 'Cambio de aceite y filtro', 'Cambio de aceite de la CVT',
  'Alineación y balanceo', 'Rotación de llantas', 'Frenos', 'Suspensión', 'Batería', 'Verificación vehicular',
  'Lavado y detallado',
];

// Puntos sobre motor.jpg (posición en % de la imagen). El frente del auto queda abajo.
export const ENGINE_BAY = [
  { x: 6.6, y: 40.5, title: 'Líquido limpiaparabrisas', where: 'Tapa azul, lado izquierdo', text: 'Usa líquido limpiaparabrisas en lugar de sólo agua: limpia mejor el polvo y no tapa los aspersores.' },
  { x: 42.3, y: 36.9, title: 'Filtro de aire', where: 'Caja negra grande al centro', text: 'Si está gris o con polvo, el motor gasta más gasolina y pierde fuerza. Se revisa en cada servicio y se cambia cuando está sucio; sopletearlo no basta.' },
  { x: 39.7, y: 45.7, title: 'Varilla de aceite de motor', where: 'Varilla amarilla', text: 'Revisar en frío y en plano. Nivel entre MIN y MAX, color ámbar; no negro espeso ni con olor a quemado.' },
  { x: 68.0, y: 32.8, title: 'Líquido de frenos', where: 'Depósito blanco chico, atrás a la derecha', text: 'Debe estar entre MIN y MAX. Si baja seguido puede ser desgaste de balatas o una fuga: no lo rellenes al tope sin revisar las balatas.' },
  { x: 77.0, y: 58.0, title: 'Batería', where: 'Lado derecho, tapa roja en el positivo', text: 'Terminales sin sarro blanco o verdoso, bien sujeta y sin hinchazón.' },
  { x: 71.9, y: 75.2, title: 'Anticongelante', where: 'Depósito blanco con tapa verde, abajo a la derecha', text: 'Nivel entre MIN y MAX con el motor frío. Usa anticongelante, no agua sola, para evitar óxido y sobrecalentamiento.' },
  { x: 67.8, y: 79.8, title: 'Tapa del radiador', where: 'Tapa con símbolo de advertencia', text: 'Nunca la abras con el motor caliente. Sólo revisa a la vista que no haya fugas, óxido o el empaque roto.' },
];

export const ENGINE_BAY_NOTE = 'No se ve en la foto: la banda de accesorios (sin grietas), las mangueras (firmes y sin fugas) y la caja CVT, que no tiene varilla. Si notas tirones, patinado o ruido al arrancar, llévalo a revisar.';
