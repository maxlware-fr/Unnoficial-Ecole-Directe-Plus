/*
bin.js = FR
Bin.js est un script servant à lancer l'application en mode "powershell" pour les utilisateurs qui préfèrent cette méthode.
Cette fonctionnalité est principalement destinée à des fins de développement et de débogage, offrant une alternative à l'exécution via l'interface graphique.
Il permet de démarrer l'application avec des options spécifiques, comme le mode développeur, et de voir les logs directement dans la console.
Il est important de noter que ce script est principalement destiné à un usage de "test" et de développement, et n'est pas recommandé pour une utilisation régulière par les utilisateurs finaux.

Note: This file is intended for development and testing purposes. It allows you to run the application in a terminal environment, which can be useful for debugging and development. It is not recommended for regular use by end-users.
*/


/*
Liste des commandes :
Le prefix d'application sur le terminal est "uedp".
- `uedp start` : Démarre l'application normalement.
- `uedp start-dev` : Démarre l'application en mode développeur, avec les outils de développement ouverts.
- `uedp help` : Affiche la liste des commandes disponibles.
- `uedp clear` : Efface la console.
- `uedp exit` : Ferme l'application.

Paramètres :
- `--dev` : Démarre l'application en mode développeur.
- `--clear` : Efface la console avant de démarrer l'application.
- `--help` : Affiche la liste des commandes disponibles.
- `--exit` : Ferme l'application après le démarrage.
- `--no-splash` : Démarre l'application sans afficher l'écran de chargement.
- `--no-rpc` : Démarre l'application sans initialiser la connexion à Discord RPC.
- `--no-extension-popup` : Démarre l'application sans initialiser le popup de l'extension.
- `--no-video` : Démarre l'application sans initialiser la fonctionnalité de vidéo.
- `--no-config` : Démarre l'application sans charger la configuration utilisateur (utilise les valeurs par défaut).
- `--no-auto-update` : Démarre l'application sans vérifier les mises à jour au lancement.
- `--no-error-handling` : Démarre l'application sans le gestionnaire global d'erreurs (les erreurs ne seront pas capturées et affichées dans la console).
- `--verbose` : Affiche des logs détaillés pour le débogage.
- `--silent` : Démarre l'application en mode silencieux, avec un minimum de logs affichés.
- `--log-file` : Spécifie un fichier de log pour enregistrer les logs de l'application.
- `--no-sandbox` : Démarre l'application sans le sandbox de sécurité (non recommandé pour une utilisation régulière).
- `--force-color` : Force l'affichage des couleurs dans la console, même si le terminal ne les supporte pas nativement.
- `--no-color` : Désactive l'affichage des couleurs dans la console.
- `--debug` : Active le mode de débogage, avec des logs supplémentaires et des fonctionnalités de développement.
*/

/*
Bin.js à été crée par Maxlware.
La license est la MIT License, ce qui signifie que vous êtes libre de l'utiliser, de le modifier et de le distribuer, tant que vous respectez les conditions de la license.
Pour plus d'informations, veuillez consulter le fichier LICENSE dans le dépôt GitHub de l'application.
*/
