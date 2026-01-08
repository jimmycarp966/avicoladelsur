const fs = require('fs');
const pdf = require('pdf-parse');

const path = 'd:\\Daniel\\Paginas\\Clientes\\Avicola del Sur\\Prueba Conciliacion\\Ultimos_Movimientos (57) (1).pdf';
const dataBuffer = fs.readFileSync(path);

console.log('Analizando PDF:', path);

pdf(dataBuffer).then(function (data) {
    console.log('--- INICIO TEXTO PDF ---');
    console.log(data.text);
    console.log('--- FIN TEXTO PDF ---');
}).catch(err => {
    console.error('Error:', err);
});
