# A scaffolded APK build keeps everything; tighten before Play release.
-dontobfuscate
-keepattributes *Annotation*
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.BridgeActivity
