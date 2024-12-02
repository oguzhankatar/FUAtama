const mongoose = require('mongoose');

const sinifsSchema = new mongoose.Schema({
    name: String,
    kon: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Sinifs', sinifsSchema);
