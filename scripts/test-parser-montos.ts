/**
 * Script de prueba para validar la función limpiarMonto
 * Uso: npx tsx scripts/test-parser-montos.ts
 */

function limpiarMonto(montoStr: string | number): number {
    if (typeof montoStr === 'number') return montoStr;
    if (!montoStr) return 0;

    // Eliminar símbolos de moneda y espacios
    let limpio = montoStr.replace(/[$€\s]/g, '');

    // Caso común en Argentina: 14.000,50 (Punto para miles, coma para decimales)
    if (limpio.includes(',') && limpio.includes('.')) {
        const posComa = limpio.lastIndexOf(',');
        const posPunto = limpio.lastIndexOf('.');
        if (posComa > posPunto) {
            limpio = limpio.replace(/\./g, '').replace(',', '.');
        } else {
            limpio = limpio.replace(/,/g, '');
        }
    } else if (limpio.includes(',')) {
        const parts = limpio.split(',');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3) {
            limpio = limpio.replace(/,/g, '');
        } else {
            limpio = limpio.replace(',', '.');
        }
    } else if (limpio.includes('.')) {
        const parts = limpio.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3) {
            limpio = limpio.replace(/\./g, '');
        }
    }

    const resultado = parseFloat(limpio);
    return isNaN(resultado) ? 0 : resultado;
}

const tests = [
    { input: "14.000,00", expected: 14000 },
    { input: "14,000.00", expected: 14000 },
    { input: "$ 14.250,50", expected: 14250.5 },
    { input: "1.234", expected: 1234 },
    { input: "1,234", expected: 1234 },
    { input: "1250,75", expected: 1250.75 },
    { input: 14000, expected: 14000 },
    { input: "monto inválido", expected: 0 },
    { input: "", expected: 0 }
];

console.log("=== TEST PARSER MONTOS ===");
let passed = 0;
tests.forEach(({ input, expected }) => {
    const result = limpiarMonto(input);
    const color = result === expected ? "\x1b[32m" : "\x1b[31m";
    console.log(`${color}[${result === expected ? "OK" : "FAIL"}] Input: ${input} -> Result: ${result} (Expected: ${expected})\x1b[0m`);
    if (result === expected) passed++;
});

console.log(`\nResultados: ${passed}/${tests.length} tests pasados.`);
process.exit(passed === tests.length ? 0 : 1);
