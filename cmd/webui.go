/*
Copyright © 2025 NAME HERE <EMAIL ADDRESS>
*/
package cmd

import (
	"github.com/dhouti/tsymbiote/api/webui/tsymbiotewebui"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// webuiCmd represents the webui command
var webuiCmd = &cobra.Command{
	Use:   "webui",
	Short: "The control plane for interacting with the symbionts.",
	Long:  `The control plane for interacting with the symbionts.`,
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.PersistentFlags())
		if err != nil {
			panic(err)
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		// Setup dependencies
		tsymbiote := tsymbiotewebui.NewTSymbioteUI()
		if tsymbiote != nil {
			// Start
			tsymbiote.ListenAndServe()
		}
	},
}

func init() {
	rootCmd.AddCommand(webuiCmd)

	webuiCmd.PersistentFlags().String("hostname-prefix", "tsymbiote-webui", "A prefix to assign to the tsnet service hostname, hostname will generate a random suffix.")
	webuiCmd.PersistentFlags().String("hostname", "", "Used to set a static hostname. If not set hostname-prefix will be used.")
	webuiCmd.PersistentFlags().StringSlice("allowed-users", []string{}, "A comma separated list of allowed users IE: user.one@email.com,user.two@email.com")
	webuiCmd.PersistentFlags().StringP("port", "p", "3621", "The port to expose the service on.")
	webuiCmd.PersistentFlags().Bool("dev", false, "Set true to enable dev, runs the backend in HTTP for local dev.")
	webuiCmd.PersistentFlags().StringSlice("scopes", []string{"auth_keys", "devices:core:read"}, "Tailscale OAuth scopes")
	webuiCmd.PersistentFlags().Bool("generate-auth", false, "Generate an authkey using the oauth client when starting tsnet")
	webuiCmd.PersistentFlags().Bool("logout", true, "true will call logout on exit, this will expire the key or delete if it's ephemeral")
	webuiCmd.PersistentFlags().String("adapter-port", "3621", "The port tsymbiote-adapters are running on, they must all use the same port.")
}
