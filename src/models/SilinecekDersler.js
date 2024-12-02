const mongoose = require('mongoose');

const silinecekDerslerSchema = new mongoose.Schema({
    cut: {
        type: String,
        required: true
    }
}, { collection: 'silinecekdersler' });

module.exports = mongoose.model('SilinecekDersler', silinecekDerslerSchema);
