# Handwriting Mobile App (React Native)

This app aims to replicate the core functionality of the web application (`apps/web`) for mobile devices using React Native and Expo.

## Current Status

- Basic project setup with Expo.
- Core dependencies installed (`react-native-paper`, `@react-navigation`, `react-native-vector-icons`).
- Basic stack navigation set up in `App.js`.
- `HomeScreen` component created (`src/screens/HomeScreen.js`) with:
    - Mock API URL and utility functions.
    - Fetching and displaying recent jobs in a `DataTable`.
    - Placeholders for upload functionality and navigation.

## Next Steps

1.  **Create Shared Libraries:**
    - Move `API_BASE_URL` to a configuration file (e.g., `src/config.js` or use environment variables).
    - Create `src/lib/utils.js` and move `formatDate`, `getButtonVisibility` there.
    - Create `src/lib/statusUtils.js` and move `getStatusDisplayName`, `getStatusIcon`. Adapt `getStatusIcon` to return MaterialCommunityIcons names suitable for `react-native-paper` or `react-native-vector-icons`.
    - Import these utilities into `HomeScreen.js`.

2.  **Implement Upload Component:**
    - Create `src/components/UploadForm.js`.
    - Use `expo-document-picker` to allow users to select PDF files.
    - Implement the file upload logic to send the selected PDF to the API (`/jobs` endpoint).
    - Integrate `UploadForm` into `HomeScreen.js` and connect the `onUploadSuccess` callback to `fetchJobs`.

3.  **Refine UI:**
    - Improve styling in `HomeScreen.js` using `react-native-paper` components (e.g., themes, spacing, typography) to better match the web app.
    - Add status icons to the `DataTable` using `react-native-paper`'s `Icon` component and the adapted `getStatusIcon` function.

4.  **Implement Navigation:**
    - Create placeholder screens for `AllJobs`, `EditTex`, and `Segment` in `src/screens`.
    - Add these screens to the `StackNavigator` in `App.js`.
    - Implement the navigation logic in the `handleViewAllJobs`, `handleViewTex`, and `handleSegment` functions in `HomeScreen.js` using `navigation.navigate()`.

5.  **Error Handling & Feedback:**
    - Implement better visual feedback for API calls (loading, success, error) in `HomeScreen.js` and `UploadForm.js`, potentially using `react-native-paper`'s `Snackbar`.
    - Display API error messages more clearly to the user.

6.  **Implement Remaining Actions:**
    - Implement download functionality for generated PDF/TeX files (might require `expo-file-system`).

## Running the App

1.  Navigate to the `apps/mobile` directory.
2.  Install dependencies: `npm install`
3.  Start the development server: `npx expo start`
4.  Scan the QR code using the Expo Go app on your device or run on an emulator/simulator. 