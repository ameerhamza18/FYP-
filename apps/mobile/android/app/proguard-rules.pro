# =============================================================================
# TrustLayer — release ProGuard/R8 rules
#
# `release { minifyEnabled true }` in app/build.gradle requires this file to
# exist; without it a release build fails outright.
#
# Flutter itself is covered by the rules the Flutter Gradle plugin injects, so
# these only pin down the app's own plugins. Keep the file small and additive:
# an over-broad keep rule silently disables shrinking.
# =============================================================================

# --- flutter_secure_storage (used by hardened builds for the JWT) ------------
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# --- shared_preferences ------------------------------------------------------
-keep class io.flutter.plugins.sharedpreferences.** { *; }

# --- image_picker (screenshot analysis) --------------------------------------
-keep class io.flutter.plugins.imagepicker.** { *; }
-dontwarn io.flutter.plugins.imagepicker.**

# --- google_fonts: fetches/uses bundled font metadata reflectively -----------
-keep class com.google.fonts.** { *; }
-dontwarn com.google.fonts.**

# --- TrustLayer interception components --------------------------------------
# Declared only in AndroidManifest.xml, so R8 has no code reference to them.
# Without these keeps a minified release build can strip the interception
# receiver/service and protection silently stops working.
-keep class com.trustlayer.app.SmsInterceptor { *; }
-keep class com.trustlayer.app.NotificationInterceptorService { *; }
-keep class com.trustlayer.app.MainActivity { *; }
-keep class com.trustlayer.app.ThreatHeuristics { *; }
-keep class com.trustlayer.app.ThreatAlerts { *; }
-keep class com.trustlayer.app.InterceptionBridge { *; }

# --- Kotlin/Flutter embedding safety net -------------------------------------
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Preserve annotations used by reflection-based serialisation in plugins.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
