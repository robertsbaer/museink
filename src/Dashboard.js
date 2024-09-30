import React, { useEffect, useState, useCallback } from "react";
import { useUserData, useSignOut } from "@nhost/react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa"; // Import the back arrow icon
import Cropper from "react-easy-crop";
import { getCroppedImg } from "./cropImageHelper"; // Fix the import
import {
  GET_TATTOO_ARTIST_BY_USER_ID,
  UPDATE_TATTOO_ARTIST,
  CREATE_TATTOO_ARTIST,
  GET_ALL_TATTOO_STYLES,
  ADD_NEW_TATTOO_STYLE,
  CREATE_INVITE_CODE,
} from "./queries";
import ImageUploader from "./ImageUploader";
import nhost from "./nhost"; // Import nhost for file upload
import styled from "styled-components"; // Styled components
import "./dashboard.css"; // Import the dashboard styles
import { v4 as uuidv4 } from "uuid";

// Styled components for invite code section
const InviteContainer = styled.div`
  background-color: #2c2c2c;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.3);
  text-align: center;
`;

const InviteLink = styled.a`
  display: inline-block;
  color: #ffffff;
  background-color: #3b3b3b;
  padding: 10px 15px;
  border-radius: 5px;
  text-decoration: none;
  margin-right: 10px;
  transition: background-color 0.3s;
  word-wrap: break-word;

  &:hover {
    background-color: #4c4c4c;
  }
`;

const CopyButton = styled.button`
  background-color: #e91e63;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #ff4081;
  }
`;

const CopySuccessMessage = styled.p`
  color: #00ff00;
  margin-top: 10px;
`;

function Dashboard() {
  const user = useUserData();
  const navigate = useNavigate();
  const [profileImage, setProfileImage] = useState(null); // New state for profile image
  const [croppedImage, setCroppedImage] = useState(null);
  const [newStyle, setNewStyle] = useState(""); // Add this state for handling new styles
  const [inviteCode, setInviteCode] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [artistData, setArtistData] = useState({
    name: "",
    address: "",
    facebook: "",
    instagram: "",
    twitter: "",
    location: "",
    imageurl: "",
    styles: [],
  });

  const { data, loading, error, refetch } = useQuery(
    GET_TATTOO_ARTIST_BY_USER_ID,
    {
      variables: { user_id: user?.id }, // Add a safe check for user id
      skip: !user, // Skip the query if the user is not logged in
    }
  );

  const { data: stylesData } = useQuery(GET_ALL_TATTOO_STYLES);
  const [addNewStyle] = useMutation(ADD_NEW_TATTOO_STYLE);
  const [updateArtist] = useMutation(UPDATE_TATTOO_ARTIST);
  const [createArtist] = useMutation(CREATE_TATTOO_ARTIST);
  const [createInviteCode] = useMutation(CREATE_INVITE_CODE);
  const { signOut } = useSignOut();

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false); // Control crop modal visibility

  useEffect(() => {
    if (data && data.tattoo_artists.length > 0) {
      setArtistData(data.tattoo_artists[0]);
    }
  }, [data]);

  const handleProfileImageChange = (e) => {
    setProfileImage(URL.createObjectURL(e.target.files[0])); // Preview the image
    setShowCropModal(true); // Show the cropping modal
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels); // Set the cropped area
  }, []);

  const handleCropConfirm = async () => {
    try {
      const croppedImg = await getCroppedImg(profileImage, croppedAreaPixels); // Crop the image
      setCroppedImage(croppedImg); // Store the cropped image
      setShowCropModal(false); // Hide the cropping modal
    } catch (e) {
      console.error(e);
    }
  };

  const handleProfileImageUpload = async () => {
    if (!croppedImage) return;

    // Convert the cropped image blob into a file
    const file = new File([croppedImage], "profile-image.jpg", {
      type: "image/jpeg",
    });

    // Upload the profile image
    const { fileMetadata, error } = await nhost.storage.upload({
      file,
    });

    if (error) {
      console.error("Profile image upload error:", error);
      alert(`Upload error: ${error.message}`);
      return;
    }

    // Get the public URL for the uploaded profile image
    const imageUrl = nhost.storage.getPublicUrl({ fileId: fileMetadata.id });

    // Update artistData with the new profile image URL
    setArtistData({ ...artistData, imageurl: imageUrl });

    // Update the artist's profile in the database
    await updateArtist({
      variables: {
        id: artistData.id,
        name: artistData.name,
        address: artistData.address,
        facebook: artistData.facebook,
        instagram: artistData.instagram,
        twitter: artistData.twitter,
        location: artistData.location,
        imageurl: imageUrl, // Save the new image URL
      },
    });

    // Refetch artist data to update the UI
    await refetch();

    alert("Profile image uploaded successfully!");
  };

  const handleChange = (e) => {
    setArtistData({
      ...artistData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    try {
      if (newStyle.trim()) {
        // Split the new styles by comma and loop over each style
        const stylesArray = newStyle.split(",").map((style) => style.trim());

        for (let style of stylesArray) {
          if (style) {
            // Save each style before saving the artist profile
            const { data: styleData } = await addNewStyle({
              variables: {
                style: style,
                tattoo_artist_id: artistData.id,
              },
            });
            if (styleData) {
              setArtistData((prevData) => ({
                ...prevData,
                styles: [
                  ...(prevData.styles || []),
                  styleData.insert_styles_one,
                ],
              }));
            }
          }
        }

        // Clear the newStyle input field
        setNewStyle("");
      }

      // Check if we are updating an existing profile or creating a new one
      if (data && data.tattoo_artists.length > 0) {
        // Update existing profile
        await updateArtist({
          variables: {
            id: artistData.id,
            name: artistData.name,
            address: artistData.address,
            facebook: artistData.facebook,
            instagram: artistData.instagram,
            twitter: artistData.twitter,
            location: artistData.location,
            imageurl: artistData.imageurl,
          },
        });
      } else {
        // Create new profile
        await createArtist({
          variables: {
            user_id: user.id,
            name: artistData.name,
            address: artistData.address,
            facebook: artistData.facebook,
            instagram: artistData.instagram,
            twitter: artistData.twitter,
            location: artistData.location,
            imageurl: artistData.imageurl,
          },
        });
      }

      // Refetch the artist data after save
      await refetch();

      alert("Profile and styles saved successfully!");
    } catch (error) {
      console.error("Error saving profile or styles:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login"); // Redirect to login page after sign-out
  };

  const handleGenerateCode = async () => {
    const newCode = uuidv4(); // Generate a new UUID using uuidv4

    try {
      const { data } = await createInviteCode({
        variables: {
          creator_id: artistData.id,
          code: newCode,
        },
      });

      if (data) {
        const inviteCode = data.insert_invite_codes_one.code;
        setInviteCode(inviteCode);

        const signupUrl = `${window.location.origin}/signup?inviteCode=${inviteCode}`;
        setInviteUrl(signupUrl);
      }
    } catch (error) {
      console.error("Error generating invite code:", error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading dashboard: {error.message}</p>;
  if (!user) {
    return null; // Return null or redirect if the user is not signed in
  }

  const isProfileExist = data && data.tattoo_artists.length > 0;

  return (
    <div className="dashboard-container">
      <button className="back-button" onClick={() => navigate("/")}>
        <FaArrowLeft />
      </button>
      <h2>Dashboard</h2>
      <h3>{isProfileExist ? "Update Profile" : "Create Profile"}</h3>

      {/* Profile Image Upload */}
      {artistData.imageurl && (
        <div className="profile-image-container">
          <img
            src={artistData.imageurl}
            alt="Current Profile"
            className="profile-image"
          />
        </div>
      )}
      <div className="custom-file-upload">
        <label htmlFor="profileImageUpload" className="file-upload-label">
          Change Profile Image
        </label>
        <input
          type="file"
          id="profileImageUpload"
          onChange={handleProfileImageChange}
          accept="image/*"
          className="file-input"
        />
      </div>
      {croppedImage && (
        <>
          <img src={URL.createObjectURL(croppedImage)} alt="Cropped" />
          <button onClick={handleProfileImageUpload}>
            Upload Profile Image
          </button>
        </>
      )}

      {/* Image Cropper Modal */}
      {showCropModal && (
        <div className="cropper-modal">
          <div className="cropper-wrapper">
            <Cropper
              image={profileImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="cropper-controls">
            <button onClick={handleCropConfirm}>Confirm Crop</button>
            <button onClick={() => setShowCropModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Styles Section */}
      <h3>Styles you specialize in</h3>
      {artistData.styles && artistData.styles.length > 0 ? (
        <div className="style-list">
          {artistData.styles.map((style) => (
            <div key={style.id} className="style-item">
              <p>{style.style}</p> {/* Display the style name */}
            </div>
          ))}
        </div>
      ) : (
        <p>No styles selected yet</p>
      )}

      <h3>Tattoo style</h3>
      <input
        type="text"
        value={newStyle}
        onChange={(e) => setNewStyle(e.target.value)}
        placeholder="Your styles (separate by comma)"
      />
      <input
        type="text"
        name="name"
        value={artistData.name}
        onChange={handleChange}
        placeholder="Name"
      />
      <input
        type="text"
        name="address"
        value={artistData.address}
        onChange={handleChange}
        placeholder="Work Address"
      />
      <input
        type="text"
        name="location"
        value={artistData.location}
        onChange={handleChange}
        placeholder="City or town"
      />
      <input
        type="text"
        name="facebook"
        value={artistData.facebook}
        onChange={handleChange}
        placeholder="Facebook URL"
      />
      <input
        type="text"
        name="instagram"
        value={artistData.instagram}
        onChange={handleChange}
        placeholder="Instagram URL"
      />
      <input
        type="text"
        name="twitter"
        value={artistData.twitter}
        onChange={handleChange}
        placeholder="Twitter URL"
      />
      <button onClick={handleSave}>Save</button>

      {isProfileExist && (
        <>
          <h3>Upload Work Images</h3>
          <ImageUploader artistId={artistData.id} />
        </>
      )}

      <h3>Generate Invite Code</h3>
      <p>
        Generate a unique code to invite other tattoo artists to join the
        platform. Share the code with them to help grow the community!
      </p>
      <button onClick={handleGenerateCode}>Generate Invite Code</button>

      {inviteCode && (
        <InviteContainer>
          <p>Your invite code URL:</p>
          <InviteLink
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inviteUrl}
          </InviteLink>
          <CopyButton onClick={() => copyToClipboard(inviteUrl)}>
            Copy URL
          </CopyButton>
          {copied && (
            <CopySuccessMessage>Copied to clipboard!</CopySuccessMessage>
          )}
        </InviteContainer>
      )}

      {/* Sign Out Button */}
      <button className="signout-btn" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
}

export default Dashboard;