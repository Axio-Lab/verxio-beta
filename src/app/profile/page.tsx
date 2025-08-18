'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit3, Save, X, User, Mail, FileText, Image as ImageIcon } from 'lucide-react';
import { Tiles } from '@/components/layout/backgroundTiles';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast, ToastContainer } from 'react-toastify';
import { updateUserProfile, getUserByWallet } from '@/app/actions/user';
import "react-toastify/dist/ReactToastify.css";

interface UserProfile {
  id: string;
  walletAddress: string;
  email?: string;
  name?: string;
  bio?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { user, authenticated, ready } = usePrivy();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    avatar: ''
  });

  useEffect(() => {
    if (!ready) return;
    
    if (!authenticated) {
      router.push('/');
      return;
    }

    loadProfile();
  }, [ready, authenticated, user, router]);

  const loadProfile = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      setIsLoading(true);
      const result = await getUserByWallet(user.wallet.address);
      
      if (result.success && result.user) {
        setProfile(result.user);
        setFormData({
          name: result.user.name || '',
          email: result.user.email || '',
          bio: result.user.bio || '',
          avatar: result.user.avatar || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      setIsSaving(true);
      const result = await updateUserProfile(user.wallet.address, formData);
      
      if (result.success) {
        setProfile(result.user);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        bio: profile.bio || '',
        avatar: profile.avatar || ''
      });
    }
    setIsEditing(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 text-center">
          <VerxioLoaderWhite size="lg" />
          <p className="text-white mt-4 text-lg">Loading Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      <Tiles rows={50} cols={50} tileSize="md" />
      
      {/* Header */}
      <div className="relative z-20 bg-black/80 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <button
            onClick={() => router.back()}
            className="text-white/70 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Profile Card */}
          <Card className="bg-black/50 border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Personal Information</h2>
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-[#00adef] hover:bg-[#0098d1] text-white"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? (
                      <VerxioLoaderWhite size="sm" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Wallet Address (Read-only) */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Wallet Address</Label>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white font-mono text-sm">
                    {profile?.walletAddress ? 
                      `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}` : 
                      'Not available'
                    }
                  </p>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Name
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  />
                ) : (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white">{profile?.name || 'Not set'}</p>
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  />
                ) : (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white">{profile?.email || 'Not set'}</p>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Bio
                </Label>
                {isEditing ? (
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none"
                  />
                ) : (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white">{profile?.bio || 'No bio added yet'}</p>
                  </div>
                )}
              </div>

              {/* Avatar URL */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Avatar URL
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.avatar}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                    placeholder="Enter avatar image URL"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  />
                ) : (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    {profile?.avatar ? (
                      <div className="flex items-center gap-3">
                        <img 
                          src={profile.avatar} 
                          alt="Avatar" 
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <p className="text-white text-sm truncate">{profile.avatar}</p>
                      </div>
                    ) : (
                      <p className="text-white">No avatar set</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Account Info */}
          <Card className="bg-black/50 border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Member Since</Label>
                <p className="text-white">
                  {profile?.createdAt ? 
                    new Date(profile.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 
                    'Unknown'
                  }
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Last Updated</Label>
                <p className="text-white">
                  {profile?.updatedAt ? 
                    new Date(profile.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 
                    'Never'
                  }
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="fixed bottom-6 right-6 z-30">
        <ToastContainer 
          position="bottom-right" 
          autoClose={3000}
          theme="dark"
        />
      </div>
    </div>
  );
} 