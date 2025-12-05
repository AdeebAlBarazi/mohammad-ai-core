import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const router = express.Router();

router.post('/register', async (req,res)=>{
  try {
    const { email, password, name } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'email & password required' });
    const exists = await User.findOne({ email });
    if(exists) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });
    return res.json({ id: user._id, email: user.email });
  } catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req,res)=>{
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await user.verifyPassword(password);
    if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ uid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    return res.json({ token });
  } catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
