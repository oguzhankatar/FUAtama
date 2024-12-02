const mongoose = require('mongoose');

const kodSchema = new mongoose.Schema({
    field: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Kod', kodSchema);
