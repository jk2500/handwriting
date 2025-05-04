# Handwriting Mobile App (React Native)

This app aims to replicate the core functionality of the web application (`apps/web`) for mobile devices using React Native and Expo.

## Current Status

- Basic project setup with Expo.
- Core dependencies installed (`react-native-paper`, `@react-navigation`, `react-native-vector-icons`, `expo-document-picker`).
- Navigation structure set up with all required screens:
  - Home Screen: Upload + Recent Jobs
  - All Jobs Screen: Complete list of jobs
  - Edit TeX Screen: View and edit TeX files (placeholder)
  - Segment Screen: Document segmentation (placeholder)
- Shared libraries implemented:
  - `config.js`: Configuration variables
  - `utils.js`: Utility functions for date formatting, visibility, etc.
  - `statusUtils.js`: Status display names, icons, and colors
- Components implemented:
  - `UploadForm.js`: PDF selection and upload to API
- UI elements and styling:
  - Cards, DataTables, Buttons, Icons, etc.
  - Status indicators with icons and colors
  - Action buttons for job operations
- API integration:
  - Fetch jobs from API
  - Upload PDFs to API
  - Segment and compile operations
  - Error handling

## Known Issues

- API URL is hardcoded to `localhost:8000` - needs to be updated for actual deployment
- PDF viewer for segmentation not implemented yet
- TeX editor functionality not implemented yet
- Download functionality not implemented yet
- Limited error feedback in some edge cases

## Next Steps

1. **Implement PDF Viewer:**
   - Add PDF rendering using `react-native-pdf` or similar.
   - Implement interactive segmentation UI.

2. **Implement TeX Editor:**
   - Add code editor component for editing TeX files.
   - Implement syntax highlighting if possible.

3. **Implement Download Functionality:**
   - Add ability to download output PDFs.
   - Add ability to download TeX files.

4. **Improve Error Handling:**
   - Add more robust error handling and feedback.
   - Implement proper loading states and indicators.

5. **Add Authentication:**
   - Implement login/registration if the backend supports it.

6. **Optimize for Production:**
   - Configuration for different environments.
   - Release builds and testing.

## Running the App

1.  Navigate to the `apps/mobile` directory.
2.  Install dependencies: `npm install`
3.  Start the development server: `npx expo start`
4.  Scan the QR code using the Expo Go app on your device or run on an emulator/simulator. 