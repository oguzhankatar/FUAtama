const mongoose = require('mongoose');

const KodsSchema = new mongoose.Schema({
    field: String,
    value: String
});

module.exports = mongoose.model('Kods', KodsSchema);
