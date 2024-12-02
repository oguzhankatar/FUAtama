const mongoose = require('mongoose');

const progsSchema = new mongoose.Schema({
    program: {
        type: String,
        required: true
    },
    short: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Progs', progsSchema);
