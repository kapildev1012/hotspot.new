import bcrypt from 'bcryptjs';
import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../types/index.js';

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeId?: string; // Reference to Store if role is store-specific
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  avatar?: string;
  phone?: string;
  address?: string;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthTokens(): { accessToken: string; refreshToken: string };
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.VIEWER,
      required: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: function(this: IUser) {
        return [UserRole.STORE_MANAGER, UserRole.STORE_CLERK].includes(this.role);
      },
    },
    permissions: [{
      type: String,
      trim: true,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    avatar: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: email already has unique index from unique: true
userSchema.index({ role: 1, storeId: 1 });
userSchema.index({ isActive: 1 });

// Virtual for store details
userSchema.virtual('store', {
  ref: 'Store',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to generate default permissions based on role
userSchema.statics.getDefaultPermissions = function(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: ['*'], // All permissions
    [UserRole.WAREHOUSE_MANAGER]: [
      'warehouse:read',
      'warehouse:write',
      'inventory:read',
      'inventory:write',
      'products:read',
      'products:write',
      'transfers:approve',
      'reports:read',
      'alerts:read',
      'alerts:write',
      'stores:read',
    ],
    [UserRole.STORE_MANAGER]: [
      'store:read',
      'store:write',
      'inventory:read',
      'inventory:write',
      'products:read',
      'transactions:read',
      'transactions:write',
      'transfers:create',
      'reports:read',
      'alerts:read',
      'users:read',
    ],
    [UserRole.STORE_CLERK]: [
      'store:read',
      'inventory:read',
      'inventory:write',
      'products:read',
      'transactions:create',
      'transactions:read',
    ],
    [UserRole.AUDITOR]: [
      'inventory:read',
      'products:read',
      'transactions:read',
      'reports:read',
      'alerts:read',
      'stores:read',
      'warehouse:read',
    ],
    [UserRole.VIEWER]: [
      'inventory:read',
      'products:read',
      'reports:read',
    ],
  };
  
  return permissions[role] || [];
};

export default mongoose.model<IUser>('User', userSchema);