/*
Copyright © 2025 NAME HERE <EMAIL ADDRESS>
*/
package cmd

import (
	"github.com/dhouti/tsymbiote/api/adapter/tsymbioteadapter"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// adapterCmd represents the adapter command
var adapterCmd = &cobra.Command{
	Use:   "adapter",
	Short: "A tsnet service that can run tailscale LocalAPI calls as the host.",
	Long:  `A tsnet service that can run tailscale LocalAPI calls as the host.`,
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.PersistentFlags())
		if err != nil {
			panic(err)
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		// Setup dependencies
		tsymbiote := tsymbioteadapter.NewTSymbioteAdapter()
		if tsymbiote != nil {
			// Start
			tsymbiote.ListenAndServe()
		}
	},
}

func init() {
	rootCmd.AddCommand(adapterCmd)
	adapterCmd.PersistentFlags().String("hostname-prefix", "tsymbiote-adapter", "A prefix to assign to the tsnet service hostname.")
	adapterCmd.PersistentFlags().String("hostname", "", "Used to set a static hostname. If not set hostname-prefix will be used.")
	adapterCmd.PersistentFlags().String("allowed-tag", "tag:tsymbiote-webui", "Used to prevent access from sources that are not the web-ui. This cannot be an empty string.")
	adapterCmd.PersistentFlags().StringP("port", "p", "3621", "The port to expose the service on.")
	adapterCmd.PersistentFlags().Bool("dev", false, "Set true to enable dev, runs the backend in HTTP for local dev.")
	adapterCmd.PersistentFlags().String("socket", "", "path to tailscaled socket")
	adapterCmd.PersistentFlags().BoolP("discover-socket", "d", false, "Set true to automatically discover socket path (meant for k8s sidecar deployment)")
	adapterCmd.PersistentFlags().Bool("logout", true, "true will call logout on exit, this will expire the key or delete if it's ephemeral")
}
