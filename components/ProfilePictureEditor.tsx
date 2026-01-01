import React, { useState, useEffect } from 'react';
import { takePhoto, pickPhoto } from '../services/native';
import { applyCatFilter, CAT_FILTERS, CatFilterType, getFilterConfig } from '../services/catFilter';
import { supabase } from '../services/supabase';

interface ProfilePictureEditorProps {
  userId: string;
  currentAvatarUrl: string;
  onSave: (newAvatarUrl: string, selectedFilter: CatFilterType) => void;
  onCancel: () => void;
}

const ProfilePictureEditor: React.FC<ProfilePictureEditorProps> = ({
  userId,
  currentAvatarUrl,
  onSave,
  onCancel,
}) => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [filteredImage, setFilteredImage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<CatFilterType>('classic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(true);

  // Apply filter when image or filter changes
  useEffect(() => {
    const applyFilter = async () => {
      if (!originalImage) return;

      setIsProcessing(true);
      try {
        const result = await applyCatFilter(originalImage, selectedFilter);
        setFilteredImage(result);
      } catch (err) {
        console.error('Filter error:', err);
        setFilteredImage(originalImage);
      }
      setIsProcessing(false);
    };

    applyFilter();
  }, [originalImage, selectedFilter]);

  const handleTakePhoto = async () => {
    setError(null);
    try {
      const result = await takePhoto();
      if (result?.dataUrl) {
        setOriginalImage(result.dataUrl);
        setShowSourcePicker(false);
      } else {
        setError('Could not capture photo. Check camera permissions.');
      }
    } catch (err) {
      setError('Camera access failed. Please try again.');
    }
  };

  const handlePickPhoto = async () => {
    setError(null);
    try {
      const result = await pickPhoto();
      if (result?.dataUrl) {
        setOriginalImage(result.dataUrl);
        setShowSourcePicker(false);
      } else {
        setError('Could not select photo. Please try again.');
      }
    } catch (err) {
      setError('Photo selection failed. Please try again.');
    }
  };

  const handleUploadAndSave = async () => {
    if (!filteredImage) return;

    setIsUploading(true);
    setError(null);

    try {
      // Convert data URL to blob
      const response = await fetch(filteredImage);
      const blob = await response.blob();

      // Generate unique filename using user ID as folder
      const timestamp = Date.now();

      // Try uploading to avatars bucket first, fall back to proofs bucket
      let publicUrl: string;
      let uploadSuccess = false;

      // Try avatars bucket first
      const avatarsFilename = `${userId}/${timestamp}.jpg`;
      const { error: avatarsError } = await supabase.storage
        .from('avatars')
        .upload(avatarsFilename, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!avatarsError) {
        // Success! Get public URL from avatars bucket
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(avatarsFilename);
        publicUrl = urlData.publicUrl;
        uploadSuccess = true;
      } else {
        // Avatars bucket might not exist, fall back to proofs bucket
        console.warn('Avatars bucket upload failed, trying proofs bucket:', avatarsError);

        const proofsFilename = `avatars/${userId}/${timestamp}.jpg`;
        const { error: proofsError } = await supabase.storage
          .from('proofs')
          .upload(proofsFilename, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (proofsError) {
          console.error('Avatar upload failed to both buckets:', proofsError);
          throw new Error(`Upload failed: ${proofsError.message}`);
        }

        // Get public URL from proofs bucket
        const { data: urlData } = supabase.storage
          .from('proofs')
          .getPublicUrl(proofsFilename);
        publicUrl = urlData.publicUrl;
        uploadSuccess = true;
      }

      if (!uploadSuccess) {
        throw new Error('Failed to upload avatar to storage');
      }

      // Call onSave with the new URL
      onSave(publicUrl, selectedFilter);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
    }

    setIsUploading(false);
  };

  const handleReset = () => {
    setOriginalImage(null);
    setFilteredImage(null);
    setShowSourcePicker(true);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm">
        <div className="p-4 flex justify-between items-center border-b border-gray-800">
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors p-2 -ml-2"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
          <h2 className="text-acid-green font-mono text-sm uppercase tracking-widest">
            Profile Pic
          </h2>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Error Display */}
        {error && (
          <div className="bg-alert-red/20 border border-alert-red text-alert-red p-3 rounded-lg mb-4 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </div>
        )}

        {/* Source Picker */}
        {showSourcePicker && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-32 h-32 mx-auto rounded-full border-2 border-gray-700 overflow-hidden mb-4">
                <img
                  src={currentAvatarUrl}
                  alt="Current avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-gray-400 text-sm">
                Show the alley who you really are
              </p>
              <p className="text-gray-600 text-xs mt-1">
                (with mandatory cat filter, obviously)
              </p>
            </div>

            <button
              onClick={handleTakePhoto}
              className="w-full bg-acid-green text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white transition-colors"
            >
              <i className="fas fa-camera text-xl"></i>
              <span>Take a Selfie</span>
            </button>

            <button
              onClick={handlePickPhoto}
              className="w-full bg-gray-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 border border-gray-700 hover:border-acid-green transition-colors"
            >
              <i className="fas fa-images text-xl"></i>
              <span>Choose from Gallery</span>
            </button>

            <div className="text-center pt-4">
              <p className="text-gray-600 text-xs">
                All photos get cat-ified. No exceptions.
              </p>
            </div>
          </div>
        )}

        {/* Image Preview & Filter Selection */}
        {!showSourcePicker && originalImage && (
          <div className="space-y-6">
            {/* Preview */}
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden border-2 border-acid-green/30 shadow-[0_0_30px_rgba(204,255,0,0.1)]">
                {isProcessing ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <i className="fas fa-cat fa-spin text-4xl text-acid-green"></i>
                  </div>
                ) : null}
                <img
                  src={filteredImage || originalImage}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Retake button */}
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 w-10 h-10 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              >
                <i className="fas fa-redo"></i>
              </button>
            </div>

            {/* Filter Selection */}
            <div>
              <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3">
                Choose Your Cat Style
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {CAT_FILTERS.map((filter) => {
                  const isSelected = selectedFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedFilter(filter.id)}
                      disabled={isProcessing}
                      className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-acid-green bg-acid-green/10 shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                          isSelected ? 'bg-acid-green/20' : 'bg-gray-800'
                        }`}
                      >
                        <i
                          className={`fas ${filter.icon} text-xl ${
                            isSelected ? 'text-acid-green' : 'text-gray-500'
                          }`}
                        ></i>
                      </div>
                      <div className="text-center">
                        <div
                          className={`text-xs font-bold ${
                            isSelected ? 'text-acid-green' : 'text-gray-400'
                          }`}
                        >
                          {filter.name}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5 max-w-[80px] truncate">
                          {filter.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Filter Info */}
            {selectedFilter !== 'none' && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: getFilterConfig(selectedFilter)?.earsColor || '#333',
                    }}
                  >
                    <i className="fas fa-cat text-white"></i>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">
                      {getFilterConfig(selectedFilter)?.name}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {getFilterConfig(selectedFilter)?.description}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      {!showSourcePicker && filteredImage && (
        <div className="p-4 pb-[env(safe-area-inset-bottom)] bg-black/80 border-t border-gray-800">
          <button
            onClick={handleUploadAndSave}
            disabled={isUploading || isProcessing}
            className="w-full bg-acid-green text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                <span>Save as Profile Pic</span>
              </>
            )}
          </button>
          <p className="text-center text-gray-600 text-xs mt-2">
            This will become your identity in the alley
          </p>
        </div>
      )}
    </div>
  );
};

export default ProfilePictureEditor;
