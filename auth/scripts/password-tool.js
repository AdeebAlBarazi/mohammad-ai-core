#!/usr/bin/env node
/**
 * Auth Password Tool
 *
 * Usage examples (PowerShell):
 *   node ./scripts/password-tool.js check --login user@example.com --password Secret123!
 *   node ./scripts/password-tool.js set   --login user@example.com --password NewSecret!
 *   node ./scripts/password-tool.js set   --login user@example.com --password NewSecret! --direct
 *
 * Env:
 *   MONGO_URI (default mongodb://localhost:27017/axiomAuth)
 *   JWT_SECRET (not required here)
 */

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/axiomAuth';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next; i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const action = args._[0]; // 'check' | 'set'
  const login = args.login || args.user || args.email;
  const password = args.password;
  const direct = !!args.direct;

  if (!['check', 'set'].includes(action)) {
    console.log('Usage: node scripts/password-tool.js <check|set> --login <email|username> [--password <pwd>] [--direct]');
    process.exit(1);
  }
  if (!login) {
    console.error('Missing --login <email|username>');
    process.exit(1);
  }
  if (action === 'set' && !password) {
    console.error('Missing --password for set action');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  try {
    const User = require(path.join(__dirname, '..', 'models', 'User'));

    const user = await User.findOne({ $or: [{ email: login }, { username: login }] });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    if (action === 'check') {
      if (!password) {
        console.log('✅ User found');
        console.log('ℹ️ Provide --password to verify');
        return;
      }
      const ok = await bcrypt.compare(password, user.password);
      console.log(ok ? '✅ Password matches' : '❌ Password does not match');
      return;
    }

    // set password
    if (direct) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const coll = mongoose.connection.collection('users');
      const res = await coll.updateOne({ _id: user._id }, { $set: { password: hash } });
      if (res.modifiedCount > 0) {
        console.log('✅ Password updated (direct)');
      } else {
        console.log('❌ No document modified');
      }
    } else {
      user.password = password; // rely on model hooks if defined
      await user.save();
      console.log('✅ Password updated via model');
    }

    // verify
    const fresh = await User.findById(user._id);
    const ok = await bcrypt.compare(password, fresh.password);
    console.log(ok ? '🔍 Verify: ✅ matches' : '🔍 Verify: ❌ mismatch');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();
