const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        //const conn = await mongoose.connect('mongodb+srv://ogi:oka2323@cluster0.8ftdb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
        const conn = await mongoose.connect('mongodb+srv://ogi:oka2323@cluster0.8ftdb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`MongoDB Bağlantısı Başarılı: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Hata: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
