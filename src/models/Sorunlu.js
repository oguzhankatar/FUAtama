const mongoose = require('mongoose');



const sorunluSchema = new mongoose.Schema({
    data: [{
        dkodu: String,
        sube: String,
        dadi: String,
        program: String,
        kon: Number,
        ogrenciler: [String],
        examDate: String,  // Keep for backward compatibility
        examTime: String,  // Keep for backward compatibility
        examSiniflar: [String],  // Keep for backward compatibility
        examSlots: [{
            date: String,
            time: String,
            sinif: String
        }]
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Sorunlu', sorunluSchema);
