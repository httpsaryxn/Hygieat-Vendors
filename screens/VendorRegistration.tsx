import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image 
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { collection, addDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker'; 
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';


// ✅ NEW (Fixes Error)
import * as FileSystem from 'expo-file-system/legacy'; 

import { db } from '../config/firebase'; 

// ----------------------------------------------------------------------
// CONFIGURATION (REPLACE THESE WITH YOUR CLOUDINARY KEYS)
// ----------------------------------------------------------------------
const CLOUDINARY_CLOUD_NAME = "dgesmp2st"; 
const CLOUDINARY_UPLOAD_PRESET = "hygieat_preset"; 

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------
interface MenuItem {
  name: string;
  price: string;
  image: string; // Stores local URI first, then Cloudinary URL
}

const INITIAL_REGION = {
  latitude: 19.0760,
  longitude: 72.8777,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function VendorRegistration() {
  const [loading, setLoading] = useState(false);
  
  // Stall Details
  const [stallName, setStallName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerImage, setBannerImage] = useState<string | null>(null); 

  // Video recording state
  const [showCamera, setShowCamera] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [coordinates, setCoordinates] = useState({
    latitude: 19.0760,
    longitude: 72.8777,
  });
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { name: '', price: '', image: '' }
  ]);

  // --------------------------------------------------------------------
  // IMAGE HELPERS
  // --------------------------------------------------------------------

  // 1. Pick Image (Generic)
  const pickImage = async (type: 'banner' | 'menu', index?: number) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Access to photos is needed.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: type === 'banner' ? [16, 9] : [1, 1], // Square for menu items
      quality: 0.5, // Lower quality for faster uploads
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      
      if (type === 'banner') {
        setBannerImage(uri);
      } else if (type === 'menu' && index !== undefined) {
        // Update specific menu item
        const updatedMenu = [...menuItems];
        updatedMenu[index].image = uri;
        setMenuItems(updatedMenu);
      }
    }
  };

  // 2. Upload Logic (Reusable)
  const uploadToCloudinary = async (uri: string, publicId: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const data = new FormData();
      data.append('file', `data:image/jpeg;base64,${base64}`);
      data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      data.append('cloud_name', CLOUDINARY_CLOUD_NAME);
      data.append('folder', 'hygieat/vendors'); 
      data.append('public_id', publicId);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: data,
      });

      const result = await res.json();
      if (result.secure_url) {
        return result.secure_url;
      } else {
        throw new Error("Cloudinary upload failed");
      }
    } catch (error) {
      console.error("Upload Error:", error);
      throw error;
    }
  };

  // --------------------------------------------------------------------
  // VIDEO RECORDING FUNCTIONS
  // --------------------------------------------------------------------

  const startVideoRecording = async () => {
    if (!cameraRef.current || !cameraReady) {
      Alert.alert("Camera Not Ready", "Please wait for the camera to initialize.");
      return;
    }
    
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to record video.");
        return;
      }
    }

    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60, // Maximum 60 seconds
      });
      
      if (video) {
        setVideoUri(video.uri);
        setShowCamera(false);
      }
    } catch (error) {
      console.error("Recording Error:", error);
      Alert.alert("Error", "Failed to record video. Please try again.");
    } finally {
      setIsRecording(false);
    }
  };

  const stopVideoRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const deleteVideo = () => {
    setVideoUri(null);
  };

  // Upload Video to Cloudinary
  const uploadVideoToCloudinary = async (uri: string, publicId: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const data = new FormData();
      data.append('file', `data:video/mp4;base64,${base64}`);
      data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      data.append('cloud_name', CLOUDINARY_CLOUD_NAME);
      data.append('folder', 'hygieat/vendors/videos'); 
      data.append('public_id', publicId);
      data.append('resource_type', 'video');

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
        method: 'POST',
        body: data,
      });

      const result = await res.json();
      if (result.secure_url) {
        return result.secure_url;
      } else {
        throw new Error("Cloudinary video upload failed");
      }
    } catch (error) {
      console.error("Video Upload Error:", error);
      throw error;
    }
  };

  // --------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------

  const handleDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCoordinates({ latitude, longitude });
  };

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: '', price: '', image: '' }]);
  };

  const removeMenuItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  const updateMenuItem = (index: number, field: keyof MenuItem, value: string) => {
    const updatedMenu = [...menuItems];
    updatedMenu[index][field] = value;
    setMenuItems(updatedMenu);
  };

  const handleRegister = async () => {
    // 1. Basic Validation
    if (!stallName || !description || !bannerImage) {
      Alert.alert('Missing Fields', 'Please fill in name, description, and upload a banner.');
      return;
    }
    
    // Check if any menu item is missing a name or price (image is optional but recommended)
    const validMenu = menuItems.filter(item => item.name && item.price);
    if (validMenu.length === 0) {
      Alert.alert('Menu Empty', 'Please add at least one valid menu item.');
      return;
    }

    try {
      setLoading(true);
      const cleanStallName = stallName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

      // 2. Upload Banner
      let bannerUrl = bannerImage;
      if (bannerImage && !bannerImage.startsWith('http')) {
         bannerUrl = await uploadToCloudinary(bannerImage, `${cleanStallName}_banner`);
      }

      // 3. Upload Video (if recorded)
      let videoUrl = null;
      if (videoUri && !videoUri.startsWith('http')) {
        videoUrl = await uploadVideoToCloudinary(videoUri, `${cleanStallName}_video`);
      }

      // 4. Upload Menu Images (Parallel Processing)
      const menuWithCloudUrls = await Promise.all(
        validMenu.map(async (item, index) => {
          let imageUrl = item.image;
          
          // Only upload if it's a local file
          if (imageUrl && !imageUrl.startsWith('http')) {
            const cleanItemName = item.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
            const uniqueId = `${cleanStallName}_menu_${cleanItemName}_${Date.now()}`;
            imageUrl = await uploadToCloudinary(item.image, uniqueId);
          }
          
          return {
            ...item,
            image: imageUrl || "https://via.placeholder.com/150" // Fallback if no image uploaded
          };
        })
      );

      // 5. Save to Firestore
      const vendorData = {
        name: stallName,
        description: description,
        image: bannerUrl,
        video: videoUrl, // Add video URL
        rating: 4.5,
        hygieneGrade: "B",
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        menu: menuWithCloudUrls
      };

      const docRef = await addDoc(collection(db, 'vendors'), vendorData);
      Alert.alert('Success', 'Stall registered successfully!');
      console.log("Document written with ID: ", docRef.id);
      
    } catch (error) {
      console.error("Registration Error: ", error);
      Alert.alert('Error', 'Could not register stall. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If camera is showing, render camera view
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          videoQuality="720p"
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={() => {
                if (isRecording) {
                  stopVideoRecording();
                }
                setCameraReady(false);
                setShowCamera(false);
              }}
            >
              <Text style={styles.closeCameraText}>✕ Close</Text>
            </TouchableOpacity>
            
            <View style={styles.recordButtonContainer}>
              {!isRecording ? (
                <TouchableOpacity
                  style={[styles.recordButton, !cameraReady && styles.disabledRecordButton]}
                  onPress={startVideoRecording}
                  disabled={!cameraReady}
                >
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.recordButton, styles.stopButton]}
                  onPress={stopVideoRecording}
                >
                  <View style={styles.stopButtonInner} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Register Stall</Text>
          <Text style={styles.headerSubtitle}>
            Partner with <Text style={styles.brandText}>Hygieat</Text>
          </Text>
        </View>

        {/* 1. STALL DETAILS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stall Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Stall Name</Text>
            <TextInput
              placeholder="e.g. Raju's Chaat Center"
              placeholderTextColor="#666"
              style={styles.input}
              value={stallName}
              onChangeText={setStallName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              placeholder="Famous for spicy Vada Pav..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* BANNER PICKER */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Banner Image</Text>
            <TouchableOpacity onPress={() => pickImage('banner')} style={styles.bannerPickerBtn}>
              {bannerImage ? (
                <Image source={{ uri: bannerImage }} style={styles.imageFull} />
              ) : (
                <View style={styles.placeholderCenter}>
                  <Text style={styles.placeholderText}>+ Upload Stall Banner</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* LIVE VIDEO RECORDING */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Live Video</Text>
            {videoUri ? (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: videoUri }}
                  style={styles.videoPreview}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
                <View style={styles.videoActions}>
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={() => setShowCamera(true)}
                  >
                    <Text style={styles.retakeButtonText}>Retake Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteVideoButton}
                    onPress={deleteVideo}
                  >
                    <Text style={styles.deleteVideoButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCamera(true)}
                style={styles.videoPickerBtn}
              >
                <View style={styles.placeholderCenter}>
                  <Text style={styles.placeholderText}>📹 Record Live Video</Text>
                  <Text style={styles.placeholderSubtext}>Show your stall in real-time</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. LOCATION PICKER */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stall Location</Text>
          
          <View style={styles.mapContainer}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={INITIAL_REGION}
            >
              <Marker
                draggable
                coordinate={coordinates}
                onDragEnd={handleDragEnd}
                title="Your Stall"
                pinColor="#00C896"
              />
            </MapView>
          </View>

          <View style={styles.coordDisplay}>
            <Text style={styles.coordText}>Lat: {coordinates.latitude.toFixed(4)}</Text>
            <Text style={styles.coordText}>Lng: {coordinates.longitude.toFixed(4)}</Text>
          </View>
        </View>

        {/* 3. MENU BUILDER */}
        <View style={styles.section}>
          <View style={styles.menuHeader}>
            <Text style={styles.sectionTitle}>Menu Items</Text>
            <TouchableOpacity onPress={addMenuItem}>
              <Text style={styles.addButton}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {menuItems.map((item, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>ITEM #{index + 1}</Text>
                {index > 0 && (
                  <TouchableOpacity onPress={() => removeMenuItem(index)}>
                    <Text style={styles.removeButton}>REMOVE</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.menuRow}>
                {/* LEFT: Image Picker for Item */}
                <TouchableOpacity 
                  onPress={() => pickImage('menu', index)} 
                  style={styles.menuImagePicker}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.imageFull} />
                  ) : (
                    <Text style={styles.plusIcon}>+</Text>
                  )}
                </TouchableOpacity>

                {/* RIGHT: Inputs */}
                <View style={{ flex: 1 }}>
                  <TextInput
                    placeholder="Item Name"
                    placeholderTextColor="#666"
                    style={[styles.input, styles.compactInput]}
                    value={item.name}
                    onChangeText={(text) => updateMenuItem(index, 'name', text)}
                  />
                  
                  <TextInput
                    placeholder="Price (e.g. ₹20)"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    style={[styles.input, styles.compactInput]}
                    value={item.price}
                    onChangeText={(text) => updateMenuItem(index, 'price', text)}
                  />
                </View>
              </View>

            </View>
          ))}
        </View>

        {/* SUBMIT */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            style={[styles.submitButton, loading && styles.disabledButton]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Register Stall</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ----------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  brandText: {
    color: '#00C896',
    fontWeight: 'bold',
  },
  section: {
    padding: 24,
    paddingBottom: 0,
  },
  sectionTitle: {
    color: '#00C896',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 16,
  },
  compactInput: {
    padding: 12, 
    marginBottom: 8,
    fontSize: 14,
    backgroundColor: '#111827'
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // Banner Picker
  bannerPickerBtn: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  imageFull: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#00C896',
    fontWeight: 'bold',
  },
  placeholderSubtext: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },

  // Video Recording Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  closeCameraButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    borderRadius: 8,
  },
  closeCameraText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  recordButtonContainer: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
  },
  stopButton: {
    borderRadius: 8,
  },
  stopButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  videoPickerBtn: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  videoContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  videoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  videoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#1F2937',
  },
  retakeButton: {
    backgroundColor: '#00C896',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: '#111827',
    fontWeight: 'bold',
  },
  deleteVideoButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteVideoButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },

  // Menu Styles
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    color: '#00C896',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#6B7280',
    fontWeight: 'bold',
    fontSize: 12,
  },
  removeButton: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // New Menu Row Layout
  menuRow: {
    flexDirection: 'row',
    gap: 12,
  },
  menuImagePicker: {
    width: 80,
    height: 80,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  plusIcon: {
    color: '#6B7280',
    fontSize: 24,
  },

  // Map & Submit
  mapContainer: {
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#374151',
  },
  coordDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
  },
  coordText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#00C896',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 50,
    shadowColor: "#00C896",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#4B5563',
  },
  disabledRecordButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 18,
  },
});