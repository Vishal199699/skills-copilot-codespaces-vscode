# Add project specific ProGuard rules here.
# Keep Retrofit and Gson models
-keepattributes Signature
-keepattributes *Annotation*

-keep class com.stocktracker.data.** { *; }

-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*
