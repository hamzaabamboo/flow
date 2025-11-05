# Android App Integration Guide

This guide explains how to integrate HamAuth authentication in your Android app to access HamFlow APIs.

## Overview

HamFlow supports authentication via HamAuth (OIDC) access tokens. Your Android app can:
1. Authenticate users via HamAuth
2. Use the HamAuth access token to make API requests to HamFlow
3. Access all HamFlow features (tasks, notes, etc.)

## Architecture

```
Android App → HamAuth (OIDC) → Get Access Token
           ↓
Android App → HamFlow API (with Bearer token)
           ↓
HamFlow validates token with HamAuth → Returns data
```

## Implementation Steps

### 1. Add Dependencies

Add the AppAuth library to your `build.gradle`:

```gradle
dependencies {
    implementation 'net.openid:appauth:0.11.1'
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
}
```

### 2. Configure HamAuth

Create an `AuthConfig.kt`:

```kotlin
object AuthConfig {
    // HamAuth OIDC endpoints
    const val ISSUER_URL = "https://auth.your-domain.com"
    const val CLIENT_ID = "hamflow-android"
    const val REDIRECT_URI = "com.yourapp.hamflow://oauth-callback"

    // HamFlow API
    const val HAMFLOW_API_URL = "https://hamflow.your-domain.com"
}
```

**Note:** You need to register your Android app with HamAuth to get a `CLIENT_ID`. The redirect URI should match your app's custom scheme.

### 3. Implement Authentication

Create an `AuthManager.kt`:

```kotlin
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import net.openid.appauth.*

class AuthManager(private val context: Context) {
    private val serviceConfig = AuthorizationServiceConfiguration(
        Uri.parse("${AuthConfig.ISSUER_URL}/protocol/openid-connect/auth"),
        Uri.parse("${AuthConfig.ISSUER_URL}/protocol/openid-connect/token")
    )

    private val sharedPrefs = context.getSharedPreferences(
        "hamauth_prefs",
        Context.MODE_PRIVATE
    )

    /**
     * Start the login flow
     */
    fun login(launcher: ActivityResultLauncher<Intent>) {
        val authRequest = AuthorizationRequest.Builder(
            serviceConfig,
            AuthConfig.CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(AuthConfig.REDIRECT_URI)
        )
            .setScopes("openid", "profile", "email")
            .build()

        val authService = AuthorizationService(context)
        val authIntent = authService.getAuthorizationRequestIntent(authRequest)
        launcher.launch(authIntent)
    }

    /**
     * Handle the OAuth callback
     */
    fun handleAuthResponse(
        intent: Intent,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        val response = AuthorizationResponse.fromIntent(intent)
        val error = AuthorizationException.fromIntent(intent)

        if (response != null) {
            val authService = AuthorizationService(context)

            // Exchange authorization code for tokens
            authService.performTokenRequest(
                response.createTokenExchangeRequest()
            ) { tokenResponse, tokenError ->
                if (tokenResponse != null) {
                    // Save access token
                    saveAccessToken(tokenResponse.accessToken!!)
                    onSuccess(tokenResponse.accessToken!!)
                } else {
                    onError(tokenError?.message ?: "Token exchange failed")
                }
            }
        } else {
            onError(error?.message ?: "Authorization failed")
        }
    }

    /**
     * Save access token to SharedPreferences
     */
    private fun saveAccessToken(token: String) {
        sharedPrefs.edit()
            .putString("access_token", token)
            .putLong("token_saved_at", System.currentTimeMillis())
            .apply()
    }

    /**
     * Get saved access token
     */
    fun getAccessToken(): String? {
        return sharedPrefs.getString("access_token", null)
    }

    /**
     * Check if user is logged in
     */
    fun isLoggedIn(): Boolean {
        return getAccessToken() != null
    }

    /**
     * Logout
     */
    fun logout() {
        sharedPrefs.edit().clear().apply()
    }
}
```

### 4. Create HamFlow API Client

Create a `HamFlowApiClient.kt`:

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class HamFlowApiClient(private val authManager: AuthManager) {
    private val client = OkHttpClient()
    private val baseUrl = AuthConfig.HAMFLOW_API_URL

    /**
     * Make an authenticated GET request
     */
    fun get(
        endpoint: String,
        onSuccess: (JSONObject) -> Unit,
        onError: (String) -> Unit
    ) {
        val accessToken = authManager.getAccessToken()
        if (accessToken == null) {
            onError("Not authenticated")
            return
        }

        val request = Request.Builder()
            .url("$baseUrl$endpoint")
            .addHeader("Authorization", "Bearer $accessToken")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onError(e.message ?: "Network error")
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val json = JSONObject(response.body?.string() ?: "{}")
                    onSuccess(json)
                } else {
                    onError("HTTP ${response.code}: ${response.message}")
                }
            }
        })
    }

    /**
     * Make an authenticated POST request
     */
    fun post(
        endpoint: String,
        body: JSONObject,
        onSuccess: (JSONObject) -> Unit,
        onError: (String) -> Unit
    ) {
        val accessToken = authManager.getAccessToken()
        if (accessToken == null) {
            onError("Not authenticated")
            return
        }

        val requestBody = body.toString().toRequestBody(
            "application/json; charset=utf-8".toMediaType()
        )

        val request = Request.Builder()
            .url("$baseUrl$endpoint")
            .addHeader("Authorization", "Bearer $accessToken")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onError(e.message ?: "Network error")
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val json = JSONObject(response.body?.string() ?: "{}")
                    onSuccess(json)
                } else {
                    onError("HTTP ${response.code}: ${response.message}")
                }
            }
        })
    }
}
```

### 5. Use in Activity/Fragment

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var authManager: AuthManager
    private lateinit var apiClient: HamFlowApiClient

    private val authLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        authManager.handleAuthResponse(
            result.data ?: Intent(),
            onSuccess = { token ->
                Toast.makeText(this, "Login successful!", Toast.LENGTH_SHORT).show()
                loadTasks()
            },
            onError = { error ->
                Toast.makeText(this, "Login failed: $error", Toast.LENGTH_LONG).show()
            }
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        authManager = AuthManager(this)
        apiClient = HamFlowApiClient(authManager)

        // Check if already logged in
        if (authManager.isLoggedIn()) {
            loadTasks()
        } else {
            showLoginButton()
        }
    }

    private fun showLoginButton() {
        findViewById<Button>(R.id.loginButton).setOnClickListener {
            authManager.login(authLauncher)
        }
    }

    private fun loadTasks() {
        apiClient.get(
            endpoint = "/api/tasks",
            onSuccess = { json ->
                // Handle tasks JSON
                val tasks = json.getJSONArray("items")
                runOnUiThread {
                    // Update UI with tasks
                }
            },
            onError = { error ->
                runOnUiThread {
                    Toast.makeText(this, "Error: $error", Toast.LENGTH_LONG).show()
                }
            }
        )
    }
}
```

## AndroidManifest.xml Configuration

Add the OAuth redirect intent filter:

```xml
<activity
    android:name=".MainActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="com.yourapp.hamflow"
            android:host="oauth-callback" />
    </intent-filter>
</activity>
```

## Available HamFlow API Endpoints

Once authenticated, you can access these endpoints:

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create a task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

### Notes
- `GET /api/notes` - List all notes
- `POST /api/notes` - Create a note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note

### User
- `GET /api/auth/me` - Get current user info

## Token Lifecycle

### Access Token Expiration

HamAuth access tokens typically expire after 1 hour. When a token expires:

1. HamFlow will return a `401 Unauthorized` error
2. Your app should handle this by refreshing the token or re-authenticating

**Example error handling:**

```kotlin
fun handleApiError(statusCode: Int, error: String) {
    if (statusCode == 401) {
        // Token expired - need to re-authenticate
        authManager.logout()
        showLoginButton()
    } else {
        // Other error
        Toast.makeText(this, "Error: $error", Toast.LENGTH_LONG).show()
    }
}
```

### Token Refresh (Optional)

For better UX, implement token refresh:

```kotlin
// In AuthManager.kt
fun refreshToken(
    refreshToken: String,
    onSuccess: (String) -> Unit,
    onError: (String) -> Unit
) {
    val authService = AuthorizationService(context)
    val tokenRequest = TokenRequest.Builder(
        serviceConfig,
        AuthConfig.CLIENT_ID
    )
        .setGrantType(GrantTypeValues.REFRESH_TOKEN)
        .setRefreshToken(refreshToken)
        .build()

    authService.performTokenRequest(tokenRequest) { response, error ->
        if (response != null) {
            saveAccessToken(response.accessToken!!)
            if (response.refreshToken != null) {
                saveRefreshToken(response.refreshToken!!)
            }
            onSuccess(response.accessToken!!)
        } else {
            onError(error?.message ?: "Refresh failed")
        }
    }
}
```

## Security Best Practices

### 1. Store Tokens Securely

Use Android Keystore for production apps:

```kotlin
// Use EncryptedSharedPreferences instead of regular SharedPreferences
private val sharedPrefs = EncryptedSharedPreferences.create(
    "hamauth_secure_prefs",
    MasterKey.DEFAULT_MASTER_KEY_ALIAS,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

### 2. Use PKCE

AppAuth automatically uses PKCE (Proof Key for Code Exchange) for OAuth flows, which is more secure for mobile apps.

### 3. Validate SSL Certificates

Ensure your OkHttp client validates SSL certificates in production:

```kotlin
private val client = OkHttpClient.Builder()
    .certificatePinner(
        CertificatePinner.Builder()
            .add("hamflow.your-domain.com", "sha256/...")
            .build()
    )
    .build()
```

### 4. Don't Log Tokens

Never log access tokens in production:

```kotlin
// BAD
Log.d("Auth", "Token: $accessToken")

// GOOD
Log.d("Auth", "Token received: ${accessToken != null}")
```

## User Auto-Creation

When a user authenticates with HamAuth for the first time:
- HamFlow automatically creates a user account
- The email and name are pulled from HamAuth
- No additional registration is needed

## Testing

### Testing with Development Server

1. Make sure HamAuth is running and accessible
2. Update `AuthConfig.kt` to point to your development server:
   ```kotlin
   const val ISSUER_URL = "http://10.0.2.2:8080" // Android emulator localhost
   const val HAMFLOW_API_URL = "http://10.0.2.2:3000"
   ```
3. Make sure to allow clear text traffic in development (AndroidManifest.xml):
   ```xml
   <application
       android:usesCleartextTraffic="true">
   ```

### Testing Authentication Flow

1. Click "Login" button
2. Browser opens to HamAuth login page
3. Enter credentials
4. Browser redirects back to app
5. App receives access token
6. Make test API call to verify authentication

## Troubleshooting

### "Invalid Bearer token" Error

**Cause:** Token is expired or invalid

**Solution:**
1. Check if HamAuth is running and accessible
2. Verify the token is being sent correctly in the Authorization header
3. Try logging in again to get a fresh token

### "Authorization failed" Error

**Cause:** OAuth flow failed

**Solution:**
1. Check if CLIENT_ID is registered with HamAuth
2. Verify REDIRECT_URI matches what's registered
3. Check Android intent filter configuration

### Network Errors

**Cause:** Cannot reach HamFlow server

**Solution:**
1. Check network connectivity
2. Verify API URL is correct
3. For emulator, use `10.0.2.2` instead of `localhost`
4. Check firewall/proxy settings

## Example Project Structure

```
app/
├── src/main/java/com/yourapp/hamflow/
│   ├── auth/
│   │   ├── AuthConfig.kt
│   │   └── AuthManager.kt
│   ├── api/
│   │   └── HamFlowApiClient.kt
│   ├── models/
│   │   ├── Task.kt
│   │   └── Note.kt
│   └── ui/
│       ├── MainActivity.kt
│       └── TasksFragment.kt
└── AndroidManifest.xml
```

## Next Steps

1. Register your Android app with HamAuth to get a CLIENT_ID
2. Implement the authentication flow using the code above
3. Build your app's UI to display HamFlow tasks and notes
4. Test authentication and API calls
5. Add error handling and token refresh
6. Deploy to production

## Support

For issues or questions:
- Check HamFlow API documentation
- Review HamAuth OIDC configuration
- See example Raycast integration at `/packages/raycast-hamflow/`

---

**Note:** This implementation uses the standard OAuth 2.0 + OIDC flow with PKCE, which is the recommended approach for mobile apps.
