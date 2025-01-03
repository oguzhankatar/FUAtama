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
    },
    photo: {
        type: String,  // Base64 encoded image data
        default: null
    },
    assignments: [{
        dkodu: String,
        sube: String,
        dersadi: String,
        examDate: String,
        examTime: String,
        sinif: String,
        studentCount: Number // That classroom's student count
    }]
});

module.exports = mongoose.model('Gozetmen', gozetmenSchema);
