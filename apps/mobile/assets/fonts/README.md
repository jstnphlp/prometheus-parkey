# Bundled fonts

Both frontends use Nunito for rounded display typography and Inter for readable
body text and utility labels, inspired by Clucky's Nunito/Geist pairing.
SemiBold (600), Bold (700), ExtraBold (800), and Black (900) are the unmodified
TTFs from `@expo-google-fonts/nunito` version `0.4.2`. Nunito is distributed under
the SIL Open Font License; see [Nunito-OFL.txt](./Nunito-OFL.txt). The source
package license is preserved in [Nunito-LICENSE.txt](./Nunito-LICENSE.txt).

The Inter Regular and SemiBold faces are used for body text and labels. They are from
`@expo-google-fonts/inter` version `0.4.2`, under [OFL.txt](./OFL.txt).

The web stylesheet references these bundled fonts directly; neither app needs a
remote font service.

The mobile magenta UI uses local Outfit Regular (400), Medium (500), SemiBold
(600), Bold (700), ExtraBold (800), and Black (900). The original five weights
come from `@expo-google-fonts/outfit` version `0.4.3`. SemiBold was retrieved from
[Expo Google Fonts](https://github.com/expo/google-fonts/blob/master/font-packages/outfit/600SemiBold/Outfit_600SemiBold.ttf)
on 2026-11-16. See [Outfit-OFL.txt](./Outfit-OFL.txt) and
[Outfit-LICENSE.txt](./Outfit-LICENSE.txt). Brand marks remain unchanged local
images; the app never downloads fonts at runtime. Existing Nunito/Inter files
remain for other frontend consumers.
