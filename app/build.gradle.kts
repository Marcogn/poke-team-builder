plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.ksp)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.marcogn.coverdex"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.marcogn.coverdex"
        // Capacitor build shipped minSdk 24; kept as-is here — nothing in this app needs
        // java.time, so there's no reason to drop API 24-25 devices. See
        // docs/plan/native-spec.md, "Identity".
        minSdk = 24
        targetSdk = 36
        // The Capacitor build shipped versionCode 1 / "1.0". This release must be installable
        // over it, and the major bump is honest: it drops the web app and does not carry user
        // data forward (see docs/implementation-decisions.md).
        versionCode = 4
        versionName = "2.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // The release keystore's SHA-1 stays stable across builds because the keystore is generated
    // once and stored as a GitHub Actions secret rather than regenerated per run — see
    // docs/plan/phase-6-release.md. The signing config is wired up now so Phase 6 only has to add
    // secrets and documentation, not build logic.
    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("RELEASE_KEYSTORE_PATH")
            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("RELEASE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Enables the debug-only seed data flow (see data/debug/DebugSeeder.kt, added when
            // that package exists).
            buildConfigField("boolean", "SEED_DEBUG_DATA", "true")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("boolean", "SEED_DEBUG_DATA", "false")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Left unsigned (Android's default) when the release secrets aren't present, e.g. a
            // local ./gradlew assembleRelease with no CI secrets, rather than failing the build.
            if (!System.getenv("RELEASE_KEYSTORE_PATH").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }

    // Room's MigrationTestHelper reads the exported schema JSONs through
    // Instrumentation.getContext().getAssets() — Robolectric's shadow AssetManager, which is
    // backed by the real `debug` variant's merged assets directory on disk, not by the JVM test
    // classpath. Adding the schemas to sourceSets["test"].assets (the officially documented
    // pattern for instrumented androidTest) does nothing for a Robolectric-based unit test in
    // this AGP version — there is no separate assets merge for the debugUnitTest variant, so the
    // only directory Robolectric's AssetManager ever sees is `debug`'s own mergeDebugAssets
    // output. So the schemas must be wired in as a `debug` source set asset instead; the handful
    // of KB this adds to debug-only APKs is an accepted cost. Without this, Migration1To2Test
    // fails with a FileNotFoundException rather than a real migration error. See
    // docs/implementation-decisions.md, "Phase 2".
    sourceSets {
        getByName("debug") {
            assets.srcDirs("$projectDir/schemas")
        }
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    implementation(libs.androidx.navigation.compose)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.coil.compose)

    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.appcompat)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.androidx.room.testing)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.ext.junit)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
