const mongoose = require('mongoose');

const gozetmenSchema = new mongoose.Schema({
    blm: String,
    ad: String,
    kisa: String,
    katsayi: {
        type: Number,
        get: v => parseFloat(v.toFixed(2))  // For double precision
    },
    alacak: {
        type: Number,
        integer: true  // For integer
    },
    verecek: {
        type: Number,
        integer: true  // For integer
    }
});

module.exports = mongoose.model('Gozetmen', gozetmenSchema);
